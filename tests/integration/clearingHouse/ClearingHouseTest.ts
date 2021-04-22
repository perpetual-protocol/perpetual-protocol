import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BigNumber, default as BN } from "bn.js"
import { expect, use } from "chai"
import { artifacts, web3 } from "hardhat"
import { ContractFullyQualifiedName } from "../../../publish/ContractName"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ClearingHouseViewerInstance,
    ERC20FakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    MetaTxGatewayInstance,
    MinterInstance,
    RewardsDistributionFakeInstance,
    StakingReserveInstance,
    SupplyScheduleFakeInstance,
    TraderWalletContract,
    TraderWalletInstance
} from "../../../types/truffle"
import { ClearingHouse } from "../../../types/web3/ClearingHouse"
import { assertionHelper } from "../../helper/assertion-plugin"
import { PnlCalcOption, Side } from "../../helper/contract"
import { fullDeploy } from "../../helper/deploy"
import { Decimal, toDecimal, toFullDigit, toFullDigitStr } from "../../helper/number"
import { signEIP712MetaTx } from "../../helper/web3"

use(assertionHelper)

const TraderWallet = artifacts.require("TraderWallet") as TraderWalletContract
const EMPTY_STRING_IN_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

describe("ClearingHouse Test", () => {
    let addresses: string[]
    let admin: string
    let alice: string
    let bob: string
    let carol: string
    let relayer: string

    let metaTxGateway: MetaTxGatewayInstance
    let amm: AmmFakeInstance
    let insuranceFund: InsuranceFundFakeInstance
    let quoteToken: ERC20FakeInstance
    let mockPriceFeed!: L2PriceFeedMockInstance
    let rewardsDistribution: RewardsDistributionFakeInstance
    let stakingReserve: StakingReserveInstance
    let clearingHouse: ClearingHouseFakeInstance
    let clearingHouseViewer: ClearingHouseViewerInstance
    let supplySchedule: SupplyScheduleFakeInstance
    let minter: MinterInstance

    let traderWallet1: TraderWalletInstance
    let traderWallet2: TraderWalletInstance

    async function gotoNextFundingTime(): Promise<void> {
        const nextFundingTime = await amm.nextFundingTime()
        await amm.mock_setBlockTimestamp(nextFundingTime)
    }

    async function forwardBlockTimestamp(time: number): Promise<void> {
        const now = await supplySchedule.mock_getCurrentTimestamp()
        const newTime = now.addn(time)
        await rewardsDistribution.mock_setBlockTimestamp(newTime)
        await amm.mock_setBlockTimestamp(newTime)
        await supplySchedule.mock_setBlockTimestamp(newTime)
        await clearingHouse.mock_setBlockTimestamp(newTime)
        const movedBlocks = time / 15 < 1 ? 1 : time / 15

        const blockNumber = new BigNumber(await amm.mock_getCurrentBlockNumber())
        const newBlockNumber = blockNumber.addn(movedBlocks)
        await rewardsDistribution.mock_setBlockNumber(newBlockNumber)
        await amm.mock_setBlockNumber(newBlockNumber)
        await supplySchedule.mock_setBlockNumber(newBlockNumber)
        await clearingHouse.mock_setBlockNumber(newBlockNumber)
    }

    async function endEpoch(): Promise<void> {
        await forwardBlockTimestamp((await supplySchedule.mintDuration()).toNumber())
        await minter.mintReward()
    }

    async function approve(account: string, spender: string, amount: number): Promise<void> {
        await quoteToken.approve(spender, toFullDigit(amount, +(await quoteToken.decimals())), { from: account })
    }

    async function transfer(from: string, to: string, amount: number): Promise<void> {
        await quoteToken.transfer(to, toFullDigit(amount, +(await quoteToken.decimals())), { from })
    }

    function toBytes32(str: string): string {
        const paddingLen = 32 - str.length
        const hex = web3.utils.asciiToHex(str)
        return hex + "00".repeat(paddingLen)
    }

    async function syncAmmPriceToOracle() {
        const marketPrice = await amm.getSpotPrice()
        await mockPriceFeed.setPrice(marketPrice.d)
    }

    beforeEach(async () => {
        addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]
        carol = addresses[3]
        relayer = addresses[4]

        const contracts = await fullDeploy({ sender: admin })
        metaTxGateway = contracts.metaTxGateway
        amm = contracts.amm
        insuranceFund = contracts.insuranceFund
        quoteToken = contracts.quoteToken
        mockPriceFeed = contracts.priceFeed
        rewardsDistribution = contracts.rewardsDistribution
        stakingReserve = contracts.stakingReserve
        clearingHouse = contracts.clearingHouse
        clearingHouseViewer = contracts.clearingHouseViewer
        supplySchedule = contracts.supplySchedule
        clearingHouse = contracts.clearingHouse

        // Each of Alice & Bob have 5000 DAI
        await quoteToken.transfer(alice, toFullDigit(5000, +(await quoteToken.decimals())))
        await quoteToken.transfer(bob, toFullDigit(5000, +(await quoteToken.decimals())))
        await quoteToken.transfer(insuranceFund.address, toFullDigit(5000, +(await quoteToken.decimals())))

        await amm.setCap(toDecimal(0), toDecimal(0))

        await syncAmmPriceToOracle()
    })

    describe("getPersonalPositionWithFundingPayment", () => {
        it("return 0 margin when alice's position is underwater", async () => {
            // given alice takes 10x short position (size: -150) with 60 margin
            await approve(alice, clearingHouse.address, 60)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(60), toDecimal(10), toDecimal(150), {
                from: alice,
            })

            // given the underlying twap price is $2.1, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(2.1))

            // when the new fundingRate is -50% which means underlyingPrice < snapshotPrice
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(-0.5))

            // then alice need to pay 150 * 50% = $75
            // {size: -150, margin: 300} => {size: -150, margin: 0}
            const alicePosition = await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)
            expect(alicePosition.size).to.eq(toFullDigit(-150))
            expect(alicePosition.margin).to.eq(toFullDigit(0))
        })
    })

    describe("openInterestNotional", () => {
        beforeEach(async () => {
            await amm.setCap(toDecimal(0), toDecimal(600))
            await approve(alice, clearingHouse.address, 600)
            await approve(bob, clearingHouse.address, 600)
        })

        it("increase when increase position", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(600), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(600))
        })

        it("reduce when reduce position", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(600), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(300), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(300))
        })

        it("reduce when close position", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(400), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: alice })

            // expect the result will be almost 0 (with a few rounding error)
            const openInterestNotional = await clearingHouse.openInterestNotionalMap(amm.address)
            expect(openInterestNotional.toNumber()).lte(10)
        })

        it("increase when traders open positions in different direction", async () => {
            await approve(alice, clearingHouse.address, 300)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(300), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await approve(bob, clearingHouse.address, 300)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(300), toDecimal(1), toDecimal(0), {
                from: bob,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(600))
        })

        it("increase when traders open larger position in reverse direction", async () => {
            await approve(alice, clearingHouse.address, 600)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(450), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(200))
        })

        it("is 0 when everyone close position", async () => {
            // avoid two closing positions from exceeding the fluctuation limit
            await amm.setFluctuationLimitRatio(toDecimal(0.8))

            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: bob,
            })
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: alice })
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })

            // expect the result will be almost 0 (with a few rounding error)
            const openInterestNotional = await clearingHouse.openInterestNotionalMap(amm.address)
            expect(openInterestNotional.toNumber()).lte(10)
        })

        it("is 0 when everyone close position, one of them is bankrupt position", async () => {
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: bob,
            })

            // when alice close, it create bad debt (bob's position is bankrupt)
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: alice })

            // bypass the restrict mode
            await forwardBlockTimestamp(15)
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })

            // expect the result will be almost 0 (with a few rounding error)
            const openInterestNotional = await clearingHouse.openInterestNotionalMap(amm.address)
            expect(openInterestNotional.toNumber()).lte(10)
        })

        it("stop trading if it's over openInterestCap", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(600), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await expectRevert(
                clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(1), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "over limit",
            )
        })

        it("won't be limited by the open interest cap if the trader is the whitelist", async () => {
            await approve(alice, clearingHouse.address, 700)
            await clearingHouse.setWhitelist(alice)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(700), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(700))
        })

        it("won't stop trading if it's reducing position, even it's more than cap", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(600), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await amm.setCap(toDecimal(0), toDecimal(300))
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(300), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            expect(await clearingHouse.openInterestNotionalMap(amm.address)).eq(toFullDigitStr(300))
        })
    })

    describe("payFunding: when alice.size = 37.5 & bob.size = -187.5", () => {
        beforeEach(async () => {
            // given alice takes 2x long position (37.5B) with 300 margin
            await approve(alice, clearingHouse.address, 600)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(300), toDecimal(2), toDecimal(37.5), {
                from: alice,
            })

            // given bob takes 1x short position (-187.5B) with 1200 margin
            await approve(bob, clearingHouse.address, 1200)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(1200), toDecimal(1), toDecimal(187.5), {
                from: bob,
            })

            const clearingHouseBaseTokenBalance = await quoteToken.balanceOf(clearingHouse.address)
            // 300 (alice's margin) + 1200 (bob' margin) = 1500
            expect(clearingHouseBaseTokenBalance).eq(toFullDigit(1500, +(await quoteToken.decimals())))
        })

        it("will generate loss for amm when funding rate is positive and amm hold more long position", async () => {
            // given the underlying twap price is 1.59, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(1.59))

            // when the new fundingRate is 1% which means underlyingPrice < snapshotPrice
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.01))

            // then alice need to pay 1% of her position size as fundingPayment
            // {balance: 37.5, margin: 300} => {balance: 37.5, margin: 299.625}
            const alicePosition = await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)
            expect(alicePosition.size).to.eq(toFullDigit(37.5))
            expect(alicePosition.margin).to.eq(toFullDigit(299.625))

            // then bob will get 1% of her position size as fundingPayment
            // {balance: -187.5, margin: 1200} => {balance: -187.5, margin: 1201.875}
            const bobPosition = await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, bob)
            expect(bobPosition.size).to.eq(toFullDigit(-187.5))
            expect(bobPosition.margin).to.eq(toFullDigit(1201.875))

            // then fundingPayment will generate 1.5 loss and clearingHouse will withdraw in advanced from insuranceFund
            // clearingHouse: 1500 + 1.5
            // insuranceFund: 5000 - 1.5
            const clearingHouseQuoteTokenBalance = await quoteToken.balanceOf(clearingHouse.address)
            expect(clearingHouseQuoteTokenBalance).to.eq(toFullDigit(1501.5, +(await quoteToken.decimals())))
            const insuranceFundBaseToken = await quoteToken.balanceOf(insuranceFund.address)
            expect(insuranceFundBaseToken).to.eq(toFullDigit(4998.5, +(await quoteToken.decimals())))
        })

        it("will keep generating the same loss for amm when funding rate is positive and amm hold more long position", async () => {
            // given the underlying twap price is 1.59, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(1.59))

            // when the new fundingRate is 1% which means underlyingPrice < snapshotPrice, long pays short
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // same as above test case:
            // there are only 2 traders: bob and alice
            // alice need to pay 1% of her position size as fundingPayment (37.5 * 1% = 0.375)
            // bob will get 1% of her position size as fundingPayment (187.5 * 1% = 1.875)
            // ammPnl = 0.375 - 1.875 = -1.5
            // clearingHouse payFunding twice in the same condition
            // then fundingPayment will generate 1.5 * 2 loss and clearingHouse will withdraw in advanced from insuranceFund
            // clearingHouse: 1500 + 3
            // insuranceFund: 5000 - 3
            const clearingHouseQuoteTokenBalance = await quoteToken.balanceOf(clearingHouse.address)
            expect(clearingHouseQuoteTokenBalance).to.eq(toFullDigit(1503, +(await quoteToken.decimals())))
            const insuranceFundBaseToken = await quoteToken.balanceOf(insuranceFund.address)
            expect(insuranceFundBaseToken).to.eq(toFullDigit(4997, +(await quoteToken.decimals())))
        })

        it("funding rate is 1%, 1% then -1%", async () => {
            // given the underlying twap price is 1.59, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(1.59))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.01))

            // then alice need to pay 1% of her position size as fundingPayment
            // {balance: 37.5, margin: 300} => {balance: 37.5, margin: 299.625}
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(299.625),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(299.625),
            )

            // pay 1% funding again
            // {balance: 37.5, margin: 299.625} => {balance: 37.5, margin: 299.25}
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.02))
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(299.25),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(299.25),
            )

            // pay -1% funding
            // {balance: 37.5, margin: 299.25} => {balance: 37.5, margin: 299.625}
            await mockPriceFeed.setTwapPrice(toFullDigit(1.61))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.01))
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(299.625),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(299.625),
            )
        })

        it("funding rate is 1%, -1% then -1%", async () => {
            // given the underlying twap price is 1.59, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(1.59))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then alice need to pay 1% of her position size as fundingPayment
            // {balance: 37.5, margin: 300} => {balance: 37.5, margin: 299.625}
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.01))
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(299.625),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(299.625),
            )

            // pay -1% funding
            // {balance: 37.5, margin: 299.625} => {balance: 37.5, margin: 300}
            await gotoNextFundingTime()
            await mockPriceFeed.setTwapPrice(toFullDigit(1.61))
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0))
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(300),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(300),
            )

            // pay -1% funding
            // {balance: 37.5, margin: 300} => {balance: 37.5, margin: 300.375}
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(-0.01))
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(300.375),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(300.375),
            )
        })

        it("has huge funding payment profit that doesn't need margin anymore", async () => {
            // given the underlying twap price is 21.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(21.6))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then alice will get 2000% of her position size as fundingPayment
            // {balance: 37.5, margin: 300} => {balance: 37.5, margin: 1050}
            // then alice can withdraw more than her initial margin while remain the enough margin ratio
            await clearingHouse.removeMargin(amm.address, toDecimal(400), { from: alice })

            // margin = 1050 - 400 = 650
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)).margin).eq(
                toFullDigit(650),
            )
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).eq(
                toFullDigit(650),
            )
        })

        it("has huge funding payment loss that the margin become 0 with bad debt of long position", async () => {
            // given the underlying twap price is 21.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(21.6))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then bob will get 2000% of her position size as fundingPayment
            // funding payment: -187.5 x 2000% = -3750, margin is 1200 so bad debt = -3750 + 1200 = 2550
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, bob)).margin).eq(
                toFullDigit(0),
            )

            const receipt = await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "PositionChanged", {
                badDebt: toFullDigitStr(2550),
                fundingPayment: toFullDigitStr(3750),
            })
        })

        it("has huge funding payment loss that the margin become 0, can add margin", async () => {
            // given the underlying twap price is 21.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(21.6))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then bob will get 2000% of her position size as fundingPayment
            // funding payment: -187.5 x 2000% = -3750, margin is 1200 so bad debt = -3750 + 1200 = 2550
            // margin can be added but will still shows 0 until it's larger than bad debt
            await approve(bob, clearingHouse.address, 1)
            await clearingHouse.addMargin(amm.address, toDecimal(1), { from: bob })
            expect((await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, bob)).margin).eq(
                toFullDigit(0),
            )
        })

        it("has huge funding payment loss that the margin become 0, can not remove margin", async () => {
            // given the underlying twap price is 21.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(21.6))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then bob will get 2000% of her position size as fundingPayment
            // funding payment: -187.5 x 2000% = -3750, margin is 1200 so bad debt = -3750 + 1200 = 2550
            // margin can't removed
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "margin is not enough",
            )
        })

        it("reduce bad debt after adding margin to a underwater position", async () => {
            // given the underlying twap price is 21.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(21.6))
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)

            // then bob will get 2000% of her position size as fundingPayment
            // funding payment: -187.5 x 2000% = -3750, margin is 1200 so bad debt = -3750 + 1200 = 2550
            // margin can be added but will still shows 0 until it's larger than bad debt
            // margin can't removed
            await approve(bob, clearingHouse.address, 10)
            await clearingHouse.addMargin(amm.address, toDecimal(10), { from: bob })

            // badDebt 2550 - 10 margin = 2540
            const receipt = await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "PositionChanged", {
                badDebt: toFullDigitStr(2540),
                fundingPayment: toFullDigitStr(3750),
            })
        })

        it("will change nothing if the funding rate is 0", async () => {
            // when the underlying twap price is $1.6, and current snapShot price is 400B/250Q = $1.6
            await mockPriceFeed.setTwapPrice(toFullDigit(1.6))

            // when the new fundingRate is 0% which means underlyingPrice = snapshotPrice
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(0)

            // then alice's position won't change
            // {balance: 37.5, margin: 300}
            const alicePosition = await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, alice)
            expect(alicePosition.size).to.eq(toFullDigit(37.5))
            expect(alicePosition.margin).to.eq(toFullDigit(300))

            // then bob's position won't change
            // {balance: -187.5, margin: 1200}
            const bobPosition = await clearingHouseViewer.getPersonalPositionWithFundingPayment(amm.address, bob)
            expect(bobPosition.size).to.eq(toFullDigit(-187.5))
            expect(bobPosition.margin).to.eq(toFullDigit(1200))

            // clearingHouse: 1500
            // insuranceFund: 5000
            const clearingHouseBaseToken = await quoteToken.balanceOf(clearingHouse.address)
            expect(clearingHouseBaseToken).to.eq(toFullDigit(1500, +(await quoteToken.decimals())))
            const insuranceFundBaseToken = await quoteToken.balanceOf(insuranceFund.address)
            expect(insuranceFundBaseToken).to.eq(toFullDigit(5000, +(await quoteToken.decimals())))
        })
    })

    describe("add/remove margin", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(10), toDecimal(37.5), {
                from: alice,
            })

            const clearingHouseQuoteTokenBalance = await quoteToken.balanceOf(clearingHouse.address)
            expect(clearingHouseQuoteTokenBalance).eq(toFullDigit(60, +(await quoteToken.decimals())))
            const allowance = await quoteToken.allowance(alice, clearingHouse.address)
            expect(allowance).to.eq(toFullDigit(2000 - 60, +(await quoteToken.decimals())))
        })

        it("add margin", async () => {
            const receipt = await clearingHouse.addMargin(amm.address, toDecimal(80), { from: alice })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(80),
                fundingPayment: "0",
            })
            await expectEvent.inTransaction(receipt.tx, quoteToken, "Transfer", {
                from: alice,
                to: clearingHouse.address,
                value: toFullDigit(80, +(await quoteToken.decimals())),
            })
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(140))
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).to.eq(
                toFullDigit(140),
            )
        })

        it("remove margin", async () => {
            // remove margin 20
            const receipt = await clearingHouse.removeMargin(amm.address, toDecimal(20), {
                from: alice,
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(-20),
                fundingPayment: "0",
            })
            await expectEvent.inTransaction(receipt.tx, quoteToken, "Transfer", {
                from: clearingHouse.address,
                to: alice,
                value: toFullDigit(20, +(await quoteToken.decimals())),
            })

            // 60 - 20
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(40))
            // 60 - 20
            expect(await clearingHouseViewer.getPersonalBalanceWithFundingPayment(quoteToken.address, alice)).to.eq(
                toFullDigit(40),
            )
        })

        it("remove margin after pay funding", async () => {
            // given the underlying twap price is 25.5, and current snapShot price is 1600 / 62.5 = 25.6
            await mockPriceFeed.setTwapPrice(toFullDigit(25.5))

            // when the new fundingRate is 10% which means underlyingPrice < snapshotPrice
            await gotoNextFundingTime()
            await clearingHouse.payFunding(amm.address)
            expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.1))

            // remove margin 20
            const receipt = await clearingHouse.removeMargin(amm.address, toDecimal(20), {
                from: alice,
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: alice,
                amm: amm.address,
                amount: toFullDigit(-20),
                fundingPayment: toFullDigit(3.75),
            })
        })

        it("Force error, remove margin - not enough position margin", async () => {
            // margin is 60, try to remove more than 60
            const removedMargin = 61

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "revert margin is not enough",
            )
        })

        it("Force error, remove margin - not enough ratio (4%)", async () => {
            const removedMargin = 36

            // remove margin 36
            // remain margin -> 60 - 36 = 24
            // margin ratio -> 24 / 600 = 4%
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "Margin ratio not meet criteria",
            )
        })
    })

    describe("getMarginRatio", () => {
        it("get margin ratio", async () => {
            await approve(alice, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                from: alice,
            })

            const marginRatio = await clearingHouse.getMarginRatio(amm.address, alice)
            expect(marginRatio).to.eq(toFullDigit(0.1))
        })

        it("get margin ratio - long", async () => {
            await approve(alice, clearingHouse.address, 2000)

            // (1000 + x) * (100 + y) = 1000 * 100
            //
            // Alice goes long with 25 quote and 10x leverage
            // open notional: 25 * 10 = 250
            // (1000 + 250) * (100 - y) = 1000 * 100
            // y = 20
            // AMM: 1250, 80
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                from: alice,
            })

            // Bob goes short with 15 quote and 10x leverage
            // (1250 - 150) * (80 + y) = 1000 * 100
            // y = 10.9090909091
            // AMM: 1100, 90.9090909091
            await approve(bob, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(15), toDecimal(10), toDecimal(0), {
                from: bob,
            })

            // (1100 - x) * (90.9090909091 + 20) = 1000 * 100
            // position notional / x : 1100 - 901.6393442622 = 198.3606
            // unrealizedPnl: 198.3606 - 250 (open notional) = -51.6394
            // margin ratio:  (25 (margin) - 51.6394) / 198.3606 ~= -0.1342978394
            const marginRatio = await clearingHouse.getMarginRatio(amm.address, alice)
            expect(marginRatio).to.eq("-134297520661157024")
        })

        it("get margin ratio - short", async () => {
            await approve(alice, clearingHouse.address, 2000)

            // Alice goes short with 25 quote and 10x leverage
            // open notional: 25 * 10 = 250
            // (1000 - 250) * (100 + y) = 1000 * 100
            // y = 33.3333333333
            // AMM: 750, 133.3333333333
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(25), toDecimal(10), toDecimal(33.4), {
                from: alice,
            })

            // Bob goes long with 15 quote and 10x leverage
            // (750 + 150) * (133.3333333333 - y) = 1000 * 100
            // y = 22.222222222
            // AMM: 900, 111.1111111111
            await approve(bob, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(15), toDecimal(10), toDecimal(0), {
                from: bob,
            })

            // (900 + x) * (111.1111111111 - 33.3333333333) = 1000 * 100
            // position notional / x : 1285.7142857139 - 900 = 385.7142857139
            // the formula of unrealizedPnl when short is the opposite of that when long
            // unrealizedPnl: 250 (open notional) - 385.7142857139 = -135.7142857139
            // margin ratio:  (25 (margin) - 135.7142857139) / 385.7142857139 ~= -0.287037037
            const marginRatio = await clearingHouse.getMarginRatio(amm.address, alice)
            expect(marginRatio.d).to.eq("-287037037037037037")
        })

        it("get margin ratio - higher twap", async () => {
            await approve(alice, clearingHouse.address, 2000)
            await approve(bob, clearingHouse.address, 2000)

            const timestamp = new BigNumber(await amm.mock_getCurrentTimestamp())

            // Alice goes long with 25 quote and 10x leverage
            // open notional: 25 * 10 = 250
            // (1000 + 250) * (100 - y) = 1000 * 100
            // y = 20
            // AMM: 1250, 80
            let newTimestamp = timestamp.addn(15)
            await amm.mock_setBlockTimestamp(newTimestamp)
            await amm.mock_setBlockNumber(10002)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                from: alice,
            })

            // Bob goes short with 15 quote and 10x leverage
            // (1250 - 150) * (80 + y) = 1000 * 100
            // y = 10.9090909091
            // AMM: 1100, 90.9090909091
            newTimestamp = newTimestamp.addn(15 * 62)
            await amm.mock_setBlockTimestamp(newTimestamp)
            await amm.mock_setBlockNumber(10064)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(15), toDecimal(10), toDecimal(0), {
                from: bob,
            })

            // unrealized TWAP Pnl: -0.860655737704918033
            // margin ratio: (25 - 0.860655737704918033) / (250 - 0.860655737704918033) = 0.09689093601
            newTimestamp = newTimestamp.addn(15)
            await amm.mock_setBlockTimestamp(newTimestamp)
            await amm.mock_setBlockNumber(10065)
            const marginRatio = await clearingHouse.getMarginRatio(amm.address, alice)
            expect(marginRatio.d).to.eq("96890936009212041")
        })

        describe("verify margin ratio when there is funding payment", () => {
            it("when funding rate is positive", async () => {
                await approve(alice, clearingHouse.address, 2000)

                // price: 1250 / 80 = 15.625
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                    from: alice,
                })

                // given the underlying twap price: 15.5
                await mockPriceFeed.setTwapPrice(toFullDigit(15.5))

                await gotoNextFundingTime()
                await clearingHouse.payFunding(amm.address)
                expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.125))

                // marginRatio = (margin + funding payment + unrealized Pnl) / positionNotional
                // funding payment: 20 * -12.5% = -2.5
                // position notional: 250
                // margin ratio: (25 - 2.5) / 250 = 0.09
                const aliceMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, alice)
                expect(aliceMarginRatio).to.eq(toFullDigit(0.09))
            })

            it("when funding rate is negative", async () => {
                await approve(alice, clearingHouse.address, 2000)

                // price: 1250 / 80 = 15.625
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                    from: alice,
                })

                // given the underlying twap price is 15.7
                await mockPriceFeed.setTwapPrice(toFullDigit(15.7))

                await gotoNextFundingTime()
                await clearingHouse.payFunding(amm.address)
                expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(-0.075))

                // marginRatio = (margin + funding payment + unrealized Pnl) / openNotional
                // funding payment: 20 * 7.5% = 1.5
                // position notional: 250
                // margin ratio: (25 + 1.5) / 250 =  0.106
                const aliceMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, alice)
                expect(aliceMarginRatio).to.eq(toFullDigit(0.106))
            })

            it("with pnl and funding rate is positive", async () => {
                await approve(alice, clearingHouse.address, 2000)
                await approve(bob, clearingHouse.address, 2000)

                // price: 1250 / 80 = 15.625
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                    from: alice,
                })
                // price: 800 / 125 = 6.4
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(45), toDecimal(10), toDecimal(45), {
                    from: bob,
                })

                // given the underlying twap price: 6.3
                await mockPriceFeed.setTwapPrice(toFullDigit(6.3))

                await gotoNextFundingTime()
                await clearingHouse.payFunding(amm.address)
                expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(0.1))

                // marginRatio = (margin + funding payment + unrealized Pnl) / positionNotional
                // funding payment: 20 (position size) * -10% = -2
                // (800 - x) * (125 + 20) = 1000 * 100
                // position notional / x : 800 - 689.6551724138 = 110.3448275862
                // unrealized Pnl: 250 - 110.3448275862 = 139.6551724138
                // margin ratio: (25 - 2 - 139.6551724138) / 110.3448275862 = -1.0571875
                const aliceMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, alice)
                expect(aliceMarginRatio).to.eq("-1057187500000000000")

                // funding payment (bob receives): 45 * 10% = 4.5
                // margin ratio: (45 + 4.5) / 450 = 0.11
                const bobMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, bob)
                expect(bobMarginRatio).to.eq(toFullDigit(0.11))
            })

            it("with pnl and funding rate is negative", async () => {
                await approve(alice, clearingHouse.address, 2000)
                await approve(bob, clearingHouse.address, 2000)

                // price: 1250 / 80 = 15.625
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(20), {
                    from: alice,
                })
                // price: 800 / 125 = 6.4
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(45), toDecimal(10), toDecimal(45), {
                    from: bob,
                })

                // given the underlying twap price: 6.5
                await mockPriceFeed.setTwapPrice(toFullDigit(6.5))

                await gotoNextFundingTime()
                await clearingHouse.payFunding(amm.address)
                expect(await clearingHouse.getLatestCumulativePremiumFraction(amm.address)).eq(toFullDigit(-0.1))

                // funding payment (alice receives): 20 (position size) * 10% = 2
                // (800 - x) * (125 + 20) = 1000 * 100
                // position notional / x : 800 - 689.6551724138 = 110.3448275862
                // unrealized Pnl: 250 - 110.3448275862 = 139.6551724138
                // margin ratio: (25 + 2 - 139.6551724138) / 110.3448275862 = -1.0209375
                const aliceMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, alice)
                expect(aliceMarginRatio).to.eq("-1020937500000000000")

                // funding payment: 45 (position size) * -10% = -4.5
                // margin ratio: (45 - 4.5) / 450 = 0.09
                const bobMarginRatio = await clearingHouseViewer.getMarginRatio(amm.address, bob)
                expect(bobMarginRatio).to.eq(toFullDigit(0.09))
            })
        })
    })

    describe("liquidate", () => {
        enum Action {
            OPEN = 0,
            CLOSE = 1,
            LIQUIDATE = 2,
        }

        beforeEach(async () => {
            await forwardBlockTimestamp(900)
            await clearingHouse.setPartialLiquidationRatio(toDecimal(0.25))
            await clearingHouse.setLiquidationFeeRatio(toDecimal(0.025))
        })

        it("partially liquidate a long position", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)
            await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

            // when alice create a 25 margin * 10x position to get 20 long position
            // AMM after: 1250 : 80
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(0), {
                from: alice,
            })

            // when bob create a 45.18072289 margin * 1x position to get 3 short position
            // AMM after: 1204.819277 : 83
            await forwardBlockTimestamp(15) // 15 secs. later
            await clearingHouse.openPosition(
                amm.address,
                Side.SELL,
                toDecimal(45.18072289),
                toDecimal(1),
                toDecimal(0),
                {
                    from: bob,
                },
            )

            const receipt = await clearingHouse.liquidate(amm.address, alice, { from: carol })
            // partially liquidate 25%
            // liquidated positionNotional: getOutputPrice(20 (original position) * 0.25) = 68.455
            // remain positionNotional: 233.945 - 68.455 = 165.49
            // total pnl = openNotional - getOutputPrice(20) == 250 - 233.945 = 16.054(loss)
            // realizedPnl = 16.054 * 0.25 = 4.01, unrealizedPnl = 16.054 - 4.01 = 12.04
            // liquidationPenalty = liquidation fee + fee to InsuranceFund
            //                    = 68.455 * 0.0125 + 68.455 * 0.0125 = 1.711
            // remain margin = margin - realizedPnl - liquidationPenalty = 25 - 4.01 - 1.711 = 19.27
            // margin ratio = (remain margin - unrealizedPnl) / remain positionNotional
            //              = (19.27 - 12.04) / 165.49 = 0.0437
            expectEvent(receipt, "PositionLiquidated", {
                amm: amm.address,
                trader: alice,
                positionNotional: "68455640744970299586",
                positionSize: toFullDigitStr(5),
                liquidationFee: "855695509312128744",
                liquidator: carol,
                badDebt: "0",
            })
            expectEvent(receipt, "PositionChanged", {
                margin: "19274981656679729691",
                positionNotional: "68455640744970299586",
                exchangedPositionSize: toFullDigitStr(-5),
                positionSizeAfter: toFullDigitStr(15),
                realizedPnl: "-4013627324696012820",
                unrealizedPnlAfter: "-12040881974088038460",
                liquidationPenalty: "1711391018624257489",
                badDebt: "0",
            })

            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq("19274981656679729691")
            expect(await clearingHouse.getMarginRatio(amm.address, alice)).to.eq("43713253015241334")
            expect((await clearingHouse.getPosition(amm.address, alice)).size).to.eq(toFullDigit(15))
            expect(await quoteToken.balanceOf(carol)).to.eq("855695")
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("5000855695")
        })

        it("partially liquidate a short position", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)
            await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

            // when alice create a 20 margin * 10x position to get 25 short position
            // AMM after: 800 : 125
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(10), toDecimal(0), {
                from: alice,
            })

            // when bob create a 19.67213115 margin * 1x position to get 3 long position
            // AMM after: 819.6721311 : 122
            await forwardBlockTimestamp(15) // 15 secs. later
            await clearingHouse.openPosition(
                amm.address,
                Side.BUY,
                toDecimal(19.67213115),
                toDecimal(1),
                toDecimal(0),
                { from: bob },
            )

            // remainMargin = (margin + unrealizedPnL) = 20 - 15.38 = 4.62
            // marginRatio = remainMargin / openNotional = 4.62 / 100 = 0.0462 < minMarginRatio(0.05)
            // then anyone (eg. carol) can liquidate alice's position
            await syncAmmPriceToOracle()
            const receipt = await clearingHouse.liquidate(amm.address, alice, { from: carol })
            // partially liquidate 25%
            // liquidated positionNotional: getOutputPrice(25 (original position) * 0.25) = 44.258
            // remain positionNotional: 211.255 - 44.258 = 166.997
            // total pnl = openNotional - getOutputPrice(25) == 200 - 211.255 = 11.255(loss)
            // realizedPnl = 11.255 * 0.25 = 2.81, unrealizedPnl = 11.255 - 2.81 = 8.44
            // liquidationPenalty = liquidation fee + fee to InsuranceFund
            //                    = 44.258 * 0.0125 + 44.258 * 0.0125 = 1.106
            // remain margin = margin - realizedPnl - liquidationPenalty = 20 - 2.81 - 1.106 = 16.079
            // margin ratio = (remain margin - unrealizedPnl) / remain positionNotional
            //              = (16.079 - 8.44) / 166.997 = 0.0457
            expectEvent(receipt, "PositionLiquidated", {
                amm: amm.address,
                trader: alice,
                positionNotional: "44258754381889405651",
                positionSize: toFullDigitStr(6.25),
                liquidationFee: "553234429773617570",
                liquidator: carol,
                badDebt: "0",
            })
            expectEvent(receipt, "PositionChanged", {
                margin: "16079605164093693758",
                positionNotional: "44258754381889405651",
                exchangedPositionSize: toFullDigitStr(6.25),
                positionSizeAfter: toFullDigitStr(-18.75),
                realizedPnl: "-2813925976359071101",
                unrealizedPnlAfter: "-8441777929077213306",
                liquidationPenalty: "1106468859547235141",
                badDebt: "0",
            })

            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq("16079605164093693758")
            expect(await clearingHouse.getMarginRatio(amm.address, alice)).to.eq("45736327859926164")
            expect((await clearingHouse.getPosition(amm.address, alice)).size).to.eq(toFullDigit(-18.75))
            expect(await quoteToken.balanceOf(carol)).to.eq("553234")
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("5000553234")
        })

        it("a long position is under water, thus liquidating the complete position", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)
            await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

            // when alice create a 25 margin * 10x position to get 20 long position
            // AMM after: 1250 : 80
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(25), toDecimal(10), toDecimal(0), {
                from: alice,
            })

            // when bob create a 73.52941176 margin * 1x position to get 3 short position
            // AMM after: 1176.470588 : 85
            await forwardBlockTimestamp(15) // 15 secs. later
            await clearingHouse.openPosition(
                amm.address,
                Side.SELL,
                toDecimal(73.52941176),
                toDecimal(1),
                toDecimal(0),
                { from: bob },
            )

            const receipt = await clearingHouse.liquidate(amm.address, alice, { from: carol })
            // the badDebt params of the two events are different
            expectEvent(receipt, "PositionLiquidated", {
                amm: amm.address,
                trader: alice,
                positionNotional: "224089635855963718818",
                positionSize: "20000000000000000000",
                liquidationFee: "2801120448199546485",
                liquidator: carol,
                badDebt: "2801120448199546485",
            })
            expectEvent(receipt, "PositionChanged", {
                margin: "0",
                positionNotional: "224089635855963718818",
                exchangedPositionSize: "-20000000000000000000",
                positionSizeAfter: "0",
                realizedPnl: "-25910364144036281182",
                unrealizedPnlAfter: "0",
                liquidationPenalty: "25000000000000000000",
                badDebt: "910364144036281182",
            })

            expect((await clearingHouse.getPosition(amm.address, alice)).size).to.eq(0)
            expect(await quoteToken.balanceOf(carol)).to.eq("2801120")
            // 5000 - 0.91 - 2.8
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("4996288516")
        })

        it("a short position is under water, thus liquidating the complete position", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)
            await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

            // when alice create a 20 margin * 10x position to get 25 short position
            // AMM after: 800 : 125
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(10), toDecimal(0), {
                from: alice,
            })

            // when bob create a 40.33613445 margin * 1x position to get 3 long position
            // AMM after: 840.3361345 : 119
            await forwardBlockTimestamp(15) // 15 secs. later
            await clearingHouse.openPosition(
                amm.address,
                Side.BUY,
                toDecimal(40.33613445),
                toDecimal(1),
                toDecimal(0),
                {
                    from: bob,
                },
            )

            await syncAmmPriceToOracle()
            const receipt = await clearingHouse.liquidate(amm.address, alice, { from: carol })
            expectEvent(receipt, "PositionLiquidated", {
                amm: amm.address,
                trader: alice,
                positionNotional: "223493652777982118604",
                positionSize: toFullDigit(25),
                liquidationFee: "2793670659724776482",
                liquidator: carol,
                badDebt: "2793670659724776482",
            })
            expectEvent(receipt, "PositionChanged", {
                margin: "0",
                positionNotional: "223493652777982118604",
                exchangedPositionSize: "25000000000000000000",
                positionSizeAfter: "0",
                realizedPnl: "-23493652777982118604",
                unrealizedPnlAfter: "0",
                liquidationPenalty: "20000000000000000000",
                badDebt: "3493652777982118604",
            })

            expect((await clearingHouse.getPosition(amm.address, alice)).size).to.eq(0)
            expect(await quoteToken.balanceOf(carol)).to.eq("2793670")
            // 5000 - 3.49 - 2.79
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("4993712677")
        })

        it("force error, position not liquidatable due to TWAP over maintenance margin", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)

            // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100 DAI
            // AMM after: 1100 : 90.9090909091
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9.09), {
                from: bob,
            })

            // when alice create a 20 margin * 5x long position when 7.5757575758 quoteAsset = 100 DAI
            // AMM after: 1200 : 83.3333333333
            await forwardBlockTimestamp(15)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(7.57), {
                from: alice,
            })

            // when bob sell his position when 7.5757575758 quoteAsset = 100 DAI
            // AMM after: 1100 : 90.9090909091
            await forwardBlockTimestamp(600)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(7.58), {
                from: bob,
            })

            // verify alice's openNotional = 100 DAI
            // spot price PnL = positionValue - openNotional = 84.62 - 100 = -15.38
            // TWAP PnL = (70.42 * 270 + 84.62 * 15 + 99.96 * 600 + 84.62 * 15) / 900 - 100 ~= -9.39
            // Use TWAP price PnL since -9.39 > -15.38
            await forwardBlockTimestamp(15)
            const positionBefore = await clearingHouse.getPosition(amm.address, alice)
            expect(positionBefore.openNotional).to.eq(toFullDigit(100))
            expect(await clearingHouseViewer.getUnrealizedPnl(amm.address, alice, PnlCalcOption.SPOT_PRICE)).to.eq(
                new BN("-15384615384615384623"),
            )
            expect(await clearingHouseViewer.getUnrealizedPnl(amm.address, alice, PnlCalcOption.TWAP)).to.eq(
                new BN("-9386059949440231138"),
            )

            // marginRatio = (margin + unrealizedPnL) / openNotional = (20 + (-9.39)) / 100 = 0.1061 > 0.05 = minMarginRatio
            // then anyone (eg. carol) calling liquidate() would get an exception
            await syncAmmPriceToOracle()
            await expectRevert(
                clearingHouse.liquidate(amm.address, alice, { from: carol }),
                "Margin ratio not meet criteria",
            )
        })

        it("force error, position not liquidatable due to SPOT price over maintenance margin", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)

            // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100 DAI
            // AMM after: 1100 : 90.9090909091
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9.09), {
                from: alice,
            })

            // verify alice's openNotional = 100 DAI
            // spot price PnL = positionValue - openNotional = 100 - 100 = 0
            // TWAP PnL = (83.3333333333 * 885 + 100 * 15) / 900 - 100 = -16.39
            // Use spot price PnL since 0 > -16.39
            await forwardBlockTimestamp(15)
            const positionBefore = await clearingHouse.getPosition(amm.address, alice)
            expect(positionBefore.openNotional).to.eq(toFullDigit(100))

            // workaround: rounding error, should be 0 but it's actually 10 wei
            const spotPnl = await clearingHouseViewer.getUnrealizedPnl(amm.address, alice, PnlCalcOption.SPOT_PRICE)
            expect(new BN(spotPnl.d.toString()).divn(10)).to.eq("0")
            expect(await clearingHouseViewer.getUnrealizedPnl(amm.address, alice, PnlCalcOption.TWAP)).to.eq(
                new BN("-16388888888888888891"),
            )

            // marginRatio = (margin + unrealizedPnL) / openNotional = (20 + 0) / 100 = 0.2 > 0.05 = minMarginRatio
            // then anyone (eg. carol) calling liquidate() would get an exception
            await syncAmmPriceToOracle()
            await expectRevert(
                clearingHouse.liquidate(amm.address, alice, { from: carol }),
                "Margin ratio not meet criteria",
            )
        })

        it("force error, can't liquidate an empty position", async () => {
            await expectRevert(clearingHouse.liquidate(amm.address, alice, { from: carol }), "positionSize is 0")
        })

        describe("fluctuation check when liquidating", () => {
            async function openSmallPositions(
                account: string,
                side: Side,
                margin: Decimal,
                leverage: Decimal,
                count: number,
            ): Promise<void> {
                for (let i = 0; i < count; i++) {
                    await clearingHouse.openPosition(amm.address, side, margin, leverage, toDecimal(0), {
                        from: account,
                    })
                    await forwardBlockTimestamp(15)
                }
            }

            it("partially liquidate one position within the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.041))

                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100
                // AMM after: 1100 : 90.9090909091
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // when alice create a 20 margin * 5x long position when 7.5757575758 quoteAsset = 100
                // AMM after: 1200 : 83.3333333333
                // alice get: 90.9090909091 - 83.3333333333 = 7.5757575758
                await openSmallPositions(alice, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // liquidate -> return 25% base asset to AMM
                // 90.9090909091 + 1.89 = 92.8
                // AMM after: 1077.55102 : 92.8, price: 11.61
                // fluctuation: (12.1 - 11.61116202) / 12.1 = 0.04039983306
                // values can be retrieved with amm.quoteAssetReserve() & amm.baseAssetReserve()
                await syncAmmPriceToOracle()
                const receipt = await clearingHouse.liquidate(amm.address, alice, { from: carol })
                expectEvent(receipt, "PositionLiquidated")

                const baseAssetReserve = await amm.baseAssetReserve()
                const quoteAssetReserve = await amm.quoteAssetReserve()
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 10000).to.eq(92.803)
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 100).to.eq(1077.55)
            })

            it("partially liquidate two positions within the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.041))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100
                // AMM after: 1100 : 90.9090909091
                // actual margin ratio is 19.99...9%
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // when carol create a 10 margin * 5x long position when 7.5757575758 quoteAsset = 100
                // AMM after: quote = 1150
                await openSmallPositions(carol, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // when alice create a 10 margin * 5x long position
                // AMM after: quote = 1200
                await openSmallPositions(alice, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // bob short 100
                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1077.55102 : 92.8, price: 11.61
                // fluctuation: (12.1 - 11.61116202) / 12.1 = 0.04039983306
                await syncAmmPriceToOracle()
                await traderWallet1.twoLiquidations(amm.address, alice, carol)

                const baseAssetReserve = await amm.baseAssetReserve()
                const quoteAssetReserve = await amm.quoteAssetReserve()
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 10000).to.eq(92.803)
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 100).to.eq(1077.55)
            })

            it("partially liquidate three positions within the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.06))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await transfer(admin, relayer, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                await approve(relayer, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100
                // AMM after: 1100 : 90.9090909091
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // when carol create a 10 margin * 5x long position when 7.5757575758 quoteAsset = 100
                // AMM after: quote = 1150 : 86.9565217391
                await openSmallPositions(carol, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // when alice create a 10 margin * 5x long position
                // AMM after: quote = 1200 : 83.3333333333
                await openSmallPositions(alice, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // when relayer create a 2 margin * 5x long position
                // AMM after: quote = 1210 : 82.6446281
                // alice + carol + relayer get: 90.9090909091 - 82.6446281 = 8.2644628091
                await openSmallPositions(relayer, Side.BUY, toDecimal(0.4), toDecimal(5), 5)

                // AMM after: 1110 : 90.09009009, price: 12.321
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // AMM after: close to 1079.066031 : 92.67273, price: 11.64383498
                // fluctuation: (12.321 - 11.64383498) / 12.321 = 0.05496023212
                await traderWallet1.threeLiquidations(amm.address, alice, carol, relayer)

                const baseAssetReserve = await amm.baseAssetReserve()
                const quoteAssetReserve = await amm.quoteAssetReserve()
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 10000).to.eq(92.6727)
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 100).to.eq(1079.06)
            })

            it("partially liquidate two positions and completely liquidate one within the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.12))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await transfer(admin, relayer, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                await approve(relayer, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100
                // AMM after: 1100 : 90.9090909091
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // when carol create a 10 margin * 5x long position when 7.5757575758 quoteAsset = 100
                // AMM after: quote = 1150 : 86.9565217391
                await openSmallPositions(carol, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // when alice create a 10 margin * 5x long position
                // AMM after: quote = 1200 : 83.3333333333
                await openSmallPositions(alice, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // when relayer create a 10 margin * 5x long position
                // AMM after: quote = 1250 : 80
                // alice + carol + relayer get: 90.9090909091 - 80 = 10.9090909091
                await openSmallPositions(relayer, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // AMM after: 1150 : 86.9565217391, price: 13.225
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // alice's & carol's positions are partially closed, while relayer's position is closed completely
                // AMM after: close to 1084.789366 : 92.1837, price: 11.7676797
                // fluctuation: (13.225 - 11.7676797) / 13.225 = 0.1101943516
                await traderWallet1.threeLiquidations(amm.address, alice, carol, relayer)

                const baseAssetReserve = await amm.baseAssetReserve()
                const quoteAssetReserve = await amm.quoteAssetReserve()
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 10000).to.eq(92.1837)
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 100).to.eq(1084.78)
            })

            it("liquidate one complete position with the price impact exceeding the fluctuation limit ", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.147))
                await clearingHouse.setPartialLiquidationRatio(toDecimal(1))

                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100 DAI
                // AMM after: 1100 : 90.9090909091
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // when alice create a 20 margin * 5x long position when 7.5757575758 quoteAsset = 100 DAI
                // AMM after: 1200 : 83.3333333333
                await openSmallPositions(alice, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1015.384615384615384672 : 98.484848484848484854, price: 10.31
                // fluctuation: (12.1 - 10.31) / 12.1 = 0.1479
                await syncAmmPriceToOracle()
                expectEvent(await clearingHouse.liquidate(amm.address, alice, { from: carol }), "PositionLiquidated")
            })

            it("partially liquidate one position with the price impact exceeding the fluctuation limit ", async () => {
                await clearingHouse.setPartialLiquidationRatio(toDecimal(0.5))

                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

                // bob pays 20 margin * 5x quote to get 9.0909090909 base
                // AMM after: 1100 : 90.9090909091
                await openSmallPositions(bob, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // alice pays 20 margin * 5x quote to get 7.5757575758 base
                // AMM after: 1200 : 83.3333333333
                await openSmallPositions(alice, Side.BUY, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                // AMM after: 1056 : 94.697, price: 11.15136
                // fluctuation: (12.1 - 11.15136) / 12.1 = 0.0784
                await amm.setFluctuationLimitRatio(toDecimal(0.07))

                // temporarily exclude the maintenance margin ratio to openReverse
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0), { from: admin })

                await expectRevert(
                    clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(44), toDecimal(1), toDecimal(0), {
                        from: alice,
                    }),
                    "price is over fluctuation limit",
                )

                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })
                await syncAmmPriceToOracle()
                expectEvent(await clearingHouse.liquidate(amm.address, alice, { from: carol }), "PositionLiquidated")
            })

            it("force error, partially liquidate two positions while exceeding the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.147))
                await clearingHouse.setPartialLiquidationRatio(toDecimal(0.5))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // bob pays 20 margin * 5x quote to get 9.0909090909 base
                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.BUY, toDecimal(10), toDecimal(5), 2)

                // carol pays 10 margin * 5x quote to get 3.95256917 base
                // AMM after: 1150 : 86.9565217391
                await openSmallPositions(carol, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // alice pays 10 margin * 5x quote to get 3.6231884391 base
                // alice + carol base: 7.5757576091
                // AMM after: 1200 : 83.3333333, price: 14.4
                await openSmallPositions(alice, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(10), toDecimal(5), 2)

                // for verifying that even though the first tx can exceed the fluctuation limit,
                // there cannot be a second tx after it
                await amm.setFluctuationLimitRatio(toDecimal(0.038))

                // half of alice's base asset: 3.6231884391 / 2 = 1.8115942196
                // AMM after: 1078.5079927008 : 92.7206851287, price: 11.6317949032
                // fluctuation: (12.1 - 11.63) / 12.1 = 0.03884297521
                // half of carol's base asset: 3.95256917 / 2 = 1.976284585
                // AMM after: 1055.9999998134 : 94.6969697137, price: 11.1513599961
                // fluctuation: (11.63 - 11.15) / 11.63 = 0.04127257094
                await expectRevert(
                    traderWallet1.twoLiquidations(amm.address, alice, carol),
                    "price is already over fluctuation limit",
                )
            })

            it("force error, liquidate two complete positions while exceeding the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.147))
                // full liquidation
                await clearingHouse.setPartialLiquidationRatio(toDecimal(1))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // bob pays 20 margin * 5x quote to get 9.0909090909 base
                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.BUY, toDecimal(10), toDecimal(5), 2)

                // carol pays 10 margin * 5x quote to get 3.95256917 base
                // AMM after: 1150 : 86.9565217391
                await openSmallPositions(carol, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // alice pays 10 margin * 5x quote to get 3.6231884391 base
                // alice + carol base: 7.5757576091
                // AMM after: 1200 : 83.3333333, price: 14.4
                await openSmallPositions(alice, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.SELL, toDecimal(10), toDecimal(5), 2)

                await amm.setFluctuationLimitRatio(toDecimal(0.075))

                // AMM after: 1015.384615384615384672 : 98.484848484848484854, price: 10.31
                // fluctuation: (12.1 - 11.19) / 12.1 = 0.07520661157
                // fluctuation: (11.19 - 10.31005917) / 11.19 = 0.07863635657
                // fluctuation: (12.1 - 10.31005917) / 12.1 = 0.1479
                await syncAmmPriceToOracle()
                await expectRevert(
                    traderWallet1.twoLiquidations(amm.address, alice, carol),
                    "price is already over fluctuation limit",
                )
            })

            it("force error, liquidate three positions while exceeding the fluctuation limit", async () => {
                await amm.setFluctuationLimitRatio(toDecimal(0.21))
                await clearingHouse.setPartialLiquidationRatio(toDecimal(1))
                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await transfer(admin, traderWallet1.address, 1000)
                await transfer(admin, bob, 1000)
                await transfer(admin, carol, 1000)
                await transfer(admin, relayer, 1000)
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)
                await approve(carol, clearingHouse.address, 100)
                await approve(relayer, clearingHouse.address, 100)
                // maintenance margin ratio should set 20%, but due to rounding error, below margin ratio becomes 19.99..9%
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.199), { from: admin })

                // when bob create a 20 margin * 5x long position when 9.0909090909 quoteAsset = 100 DAI
                // AMM after: 1100 : 90.9090909091, price: 12.1
                await openSmallPositions(bob, Side.BUY, toDecimal(10), toDecimal(5), 2)

                // when carol create a 10 margin * 5x long position when 7.5757575758 quoteAsset = 100 DAI
                // AMM after: 1150 : 86.9565
                await openSmallPositions(carol, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // when alice create a 10 margin * 5x long position
                // AMM after: 1200 : 83.3333333, price: 14.4
                await openSmallPositions(alice, Side.BUY, toDecimal(5), toDecimal(5), 2)

                // when relayer create a 10 margin * 5x long position
                // AMM after: quote = 1250
                await openSmallPositions(relayer, Side.BUY, toDecimal(2), toDecimal(5), 5)

                // AMM after: 1150 : 86.9565, price: 13.225
                await openSmallPositions(bob, Side.SELL, toDecimal(4), toDecimal(5), 5)

                await amm.setFluctuationLimitRatio(toDecimal(0.1))

            // AMM after: close to 1021.8093699518 : 97.8656126482, price: 10.4409438852
            // fluctuation: (13.225 - 10.4409438852) / 13.225 = 0.2105146401
            await syncAmmPriceToOracle()
            await expectRevert(
                traderWallet1.threeLiquidations(amm.address, alice, carol, relayer),
                "price is over fluctuation limit",
            )
        })

        describe("liquidator front run hack", () => {
            beforeEach(async () => {
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 1000)
                await approve(bob, clearingHouse.address, 1000)
                await approve(carol, clearingHouse.address, 1000)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })
            })

            async function makeAliceLiquidatableByShort(): Promise<void> {
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9.09), {
                    from: bob,
                })
                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(7.57), {
                    from: alice,
                })
                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(7.58), {
                    from: bob,
                })
                await forwardBlockTimestamp(15)
                // remainMargin = (margin + unrealizedPnL) = 20 - 15.38 = 4.62
                // marginRatio of alice = remainMargin / openNotional = 4.62 / 100 = 0.0462 < minMarginRatio(0.05)
            }

            async function makeAliceLiquidatableByLong(): Promise<void> {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await forwardBlockTimestamp(15)
                await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })
                await forwardBlockTimestamp(15)
                // marginRatio = (margin + unrealizedPnL) / openNotional = (20 + (-21.95)) / 100 = -0.0195 < 0.05 = minMarginRatio
            }

            it("liquidator can open position and liquidate in the next block", async () => {
                await makeAliceLiquidatableByShort()

                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: carol,
                })
                await forwardBlockTimestamp(15)
                await syncAmmPriceToOracle()
                expectEvent(await clearingHouse.liquidate(amm.address, alice, { from: carol }), "PositionLiquidated")
            })

            it("can open position (short) and liquidate, but can't do anything more action in the same block", async () => {
                await makeAliceLiquidatableByShort()

                // short to make alice loss more and make insuranceFund loss more
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: carol,
                })
                await syncAmmPriceToOracle()
                await clearingHouse.liquidate(amm.address, alice, { from: carol })
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(0), { from: carol }),
                    "only one action allowed",
                )
            })

            it("can open position (long) and liquidate, but can't do anything more action in the same block", async () => {
                await makeAliceLiquidatableByLong()

                // short to make alice loss more and make insuranceFund loss more
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: carol,
                })
                await syncAmmPriceToOracle()
                await clearingHouse.liquidate(amm.address, alice, { from: carol })
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(0), { from: carol }),
                    "only one action allowed",
                )
            })

            it("can open position and liquidate, but can't do anything more action in the same block", async () => {
                await makeAliceLiquidatableByShort()

                // open a long position, make alice loss less
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(10), toDecimal(1), toDecimal(0), {
                    from: carol,
                })
                await syncAmmPriceToOracle()
                await clearingHouse.liquidate(amm.address, alice, { from: carol })
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(0), { from: carol }),
                    "only one action allowed",
                )
            })

            it("can open position (even the same side, short), but can't do anything more action in the same block", async () => {
                await makeAliceLiquidatableByLong()

                // open a short position, make alice loss less
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(1), toDecimal(0), {
                    from: carol,
                })
                await syncAmmPriceToOracle()
                await clearingHouse.liquidate(amm.address, alice, { from: carol })
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(0), { from: carol }),
                    "only one action allowed",
                )
            })

            it("liquidator can't open and liquidate position in the same block, even from different msg.sender", async () => {
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 1000)
                await approve(bob, clearingHouse.address, 1000)
                await approve(carol, clearingHouse.address, 1000)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)
                traderWallet2 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await approve(alice, traderWallet1.address, 500)
                await approve(alice, traderWallet2.address, 500)
                await transfer(alice, traderWallet1.address, 500)
                await transfer(alice, traderWallet2.address, 500)

                await makeAliceLiquidatableByShort()
                await traderWallet1.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await syncAmmPriceToOracle()
                await traderWallet2.liquidate(amm.address, alice, { from: bob })
                await expectRevert(traderWallet1.closePosition(amm.address, { from: bob }), "only one action allowed")
            })

            it("liquidator can't open and liquidate position in the same block, even from different tx.origin", async () => {
                await transfer(admin, carol, 1000)
                await approve(alice, clearingHouse.address, 1000)
                await approve(bob, clearingHouse.address, 1000)
                await approve(carol, clearingHouse.address, 1000)
                await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.1), { from: admin })

                traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)
                traderWallet2 = await TraderWallet.new(clearingHouse.address, quoteToken.address)

                await approve(alice, traderWallet1.address, 500)
                await approve(alice, traderWallet2.address, 500)
                await transfer(alice, traderWallet1.address, 500)
                await transfer(alice, traderWallet2.address, 500)

                await makeAliceLiquidatableByShort()
                await traderWallet1.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await syncAmmPriceToOracle()
                await traderWallet2.liquidate(amm.address, alice, { from: carol })
                await expectRevert(traderWallet1.closePosition(amm.address, { from: admin }), "only one action allowed")
            })
        })
    })

    describe("clearingHouse", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 100)
            const clearingHouseBaseTokenBalance = await quoteToken.allowance(alice, clearingHouse.address)
            expect(clearingHouseBaseTokenBalance).eq(toFullDigit(100, +(await quoteToken.decimals())))
        })

        it("clearingHouse should take openPosition meta tx", async () => {
            await approve(bob, clearingHouse.address, 200)

            const ClearingHouseArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.ClearingHouse)
            // see: https://github.com/ethereum-ts/TypeChain/blob/master/examples/web3-v1/src/index.ts#L13
            const clearingHouseWeb3Contract = (new web3.eth.Contract(
                ClearingHouseArtifact.abi,
                clearingHouse.address,
            ) as unknown) as ClearingHouse

            const metaTx = {
                from: bob,
                to: clearingHouse.address,
                functionSignature: clearingHouseWeb3Contract.methods
                    .openPosition(
                        amm.address,
                        Side.SELL,
                        [toFullDigitStr(20)],
                        [toFullDigitStr(5)],
                        [toFullDigitStr(11.12)],
                    )
                    .encodeABI(),
                nonce: 0,
            }

            const signedResponse = await signEIP712MetaTx(
                bob,
                {
                    name: "Perp",
                    version: "1",
                    chainId: 1234, // L1 chain ID as defined in fullDeploy()
                    verifyingContract: metaTxGateway.address,
                },
                metaTx,
            )
            await metaTxGateway.executeMetaTransaction(
                metaTx.from,
                metaTx.to,
                metaTx.functionSignature,
                signedResponse.r,
                signedResponse.s,
                signedResponse.v,
                {
                    from: relayer,
                },
            )

            const position = await clearingHouse.getPosition(amm.address, bob)
            expect(position.openNotional.d).to.eq(toFullDigitStr(20 * 5))
        })

        it("clearingHouse should have enough balance after close position", async () => {
            await approve(bob, clearingHouse.address, 200)

            // AMM after: 900 : 111.1111111111
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(11.12), {
                from: bob,
            })

            // AMM after: 800 : 125
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(25), toDecimal(4), toDecimal(13.89), {
                from: alice,
            })
            // 20(bob's margin) + 25(alice's margin) = 45
            expect(await quoteToken.balanceOf(clearingHouse.address)).to.eq(
                toFullDigit(45, +(await quoteToken.decimals())),
            )

            // when bob close his position (11.11)
            // AMM after: 878.0487804877 : 113.8888888889
            // Bob's PnL = 21.951219512195121950
            // need to return Bob's margin 20 and PnL 21.951 = 41.951
            // clearingHouse balance: 45 - 41.951 = 3.048...
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq(
                toFullDigit(5000, +(await quoteToken.decimals())),
            )
            expect(await quoteToken.balanceOf(clearingHouse.address)).to.eq("3048781")
        })

        it("clearingHouse doesn't have enough balance after close position and ask for InsuranceFund", async () => {
            await approve(bob, clearingHouse.address, 200)

            // AMM after: 900 : 111.1111111111
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(11.12), {
                from: bob,
            })

            // AMM after: 800 : 125
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(13.89), {
                from: alice,
            })
            // 20(bob's margin) + 20(alice's margin) = 40
            expect(await quoteToken.balanceOf(clearingHouse.address)).to.eq(
                toFullDigit(40, +(await quoteToken.decimals())),
            )

            // when bob close his position (11.11)
            // AMM after: 878.0487804877 : 113.8888888889
            // Bob's PnL = 21.951219512195121950
            // need to return Bob's margin 20 and PnL 21.951 = 41.951
            // clearingHouse balance: 40 - 41.951 = -1.95...
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })
            expect(await quoteToken.balanceOf(insuranceFund.address)).to.eq("4998048781")
            expect(await quoteToken.balanceOf(clearingHouse.address)).to.eq(toFullDigit(0))
        })
    })

    describe("fluctuation limit, except liquidation", () => {
        it("force error, open position/internalIncrease exceeds the fluctuation limit", async () => {
            await approve(alice, clearingHouse.address, 100)
            await amm.setFluctuationLimitRatio(toDecimal(0.2))

            // alice pays 20 margin * 5x long quote when 9.0909091 base
            // AMM after: 1100 : 90.9090909, price: 12.1000000012
            await expectRevert(
                clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9), {
                    from: alice,
                }),
                "price is over fluctuation limit",
            )
        })

        it("force error, reduce position exceeds the fluctuation limit", async () => {
            await approve(alice, clearingHouse.address, 500)
            await amm.setFluctuationLimitRatio(toDecimal(1))

            // alice pays 250 margin * 1x long to get 20 base
            // AMM after: 1250 : 80, price: 15.625
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(250), toDecimal(1), toDecimal(0), {
                from: alice,
            })

            await amm.setFluctuationLimitRatio(toDecimal(0.078))
            // AMM after: 1200 : 83.3333333333, price: 14.4
            // price fluctuation: (15.625 - 14.4) / 15.625 = 0.0784
            await expectRevert(
                clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(50), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "price is over fluctuation limit",
            )
        })
    })

    describe("close position limit", () => {
        it("force error, exceeding fluctuation limit twice in the same block", async () => {
            await approve(alice, clearingHouse.address, 100)
            await approve(bob, clearingHouse.address, 100)

            // when bob create a 20 margin * 5x long position when 9.0909091 quoteAsset = 100 DAI
            // AMM after: 1100 : 90.9090909, price: 12.1000000012
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9), {
                from: bob,
            })

            // when alice create a 20 margin * 5x long position when 7.5757609 quoteAsset = 100 DAI
            // AMM after: 1200 : 83.3333333, price: 14.4000000058
            await forwardBlockTimestamp(15)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(7.5), {
                from: alice,
            })

            await forwardBlockTimestamp(15)
            // set 0.15 here to avoid the above opening positions from failing
            await amm.setFluctuationLimitRatio(toDecimal(0.15))

            // after alice closes her position, price: 12.1000000012
            // price fluctuation: (14.4000000058 - 12.1000000012) / 14.4000000058 = 0.1597222225
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: alice })

            // after bob closes his position, price: 10
            // price fluctuation: (12.1000000012 - 10) / 12.1000000012 = 0.1735537191
            await expectRevert(
                clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob }),
                "price is already over fluctuation limit",
            )
        })

        describe("slippage limit", () => {
            beforeEach(async () => {
                await forwardBlockTimestamp(900)
            })

            // Case 1
            it("closePosition, originally long, (amount should pay = 118.03279) at the limit of min quote amount = 118", async () => {
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)

                // when bob create a 20 margin * 5x short position when 9.0909091 quoteAsset = 100 DAI
                // AMM after: 1100 : 90.9090909
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9), {
                    from: bob,
                })

                // when alice create a 20 margin * 5x short position when 7.5757609 quoteAsset = 100 DAI
                // AMM after: 1200 : 83.3333333
                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(7.5), {
                    from: alice,
                })

                // when bob close his position
                // AMM after: 1081.96721 : 92.4242424
                await forwardBlockTimestamp(15)
                await clearingHouse.closePosition(amm.address, toDecimal(118), { from: bob })

                const quoteAssetReserve = await amm.quoteAssetReserve()
                const baseAssetReserve = await amm.baseAssetReserve()
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 100).to.eq(1081.96)
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 10000).to.eq(92.4242)
            })

            // Case 2
            it("closePosition, originally short, (amount should pay = 78.048) at the limit of max quote amount = 79", async () => {
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)

                // when bob create a 20 margin * 5x short position when 11.1111111111 quoteAsset = 100 DAI
                // AMM after: 900 : 111.1111111111
                await clearingHouse.openPosition(
                    amm.address,
                    Side.SELL,
                    toDecimal(20),
                    toDecimal(5),
                    toDecimal(11.12),
                    {
                        from: bob,
                    },
                )

                // when alice create a 20 margin * 5x short position when 13.8888888889 quoteAsset = 100 DAI
                // AMM after: 800 : 125
                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(
                    amm.address,
                    Side.SELL,
                    toDecimal(20),
                    toDecimal(5),
                    toDecimal(13.89),
                    {
                        from: alice,
                    },
                )

                // when bob close his position
                // AMM after: 878.0487804877 : 113.8888888889
                await forwardBlockTimestamp(15)
                await clearingHouse.closePosition(amm.address, toDecimal(79), { from: bob })

                const quoteAssetReserve = await amm.quoteAssetReserve()
                const baseAssetReserve = await amm.baseAssetReserve()
                expect(parseFloat(quoteAssetReserve.toString().substr(0, 6)) / 1000).to.eq(878.048)
                expect(parseFloat(baseAssetReserve.toString().substr(0, 6)) / 1000).to.eq(113.888)
            })

            // expectRevert section
            // Case 1
            it("force error, closePosition, originally long, less than min quote amount = 119", async () => {
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)

                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(9), {
                    from: bob,
                })

                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(7.5), {
                    from: alice,
                })

                await forwardBlockTimestamp(15)
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(119), { from: bob }),
                    "Less than minimal quote token",
                )
            })

            // Case 2
            it("force error, closePosition, originally short, more than max quote amount = 78", async () => {
                await approve(alice, clearingHouse.address, 100)
                await approve(bob, clearingHouse.address, 100)

                await clearingHouse.openPosition(
                    amm.address,
                    Side.SELL,
                    toDecimal(20),
                    toDecimal(5),
                    toDecimal(11.12),
                    {
                        from: bob,
                    },
                )

                await forwardBlockTimestamp(15)
                await clearingHouse.openPosition(
                    amm.address,
                    Side.SELL,
                    toDecimal(20),
                    toDecimal(5),
                    toDecimal(13.89),
                    {
                        from: alice,
                    },
                )

                await forwardBlockTimestamp(15)
                await expectRevert(
                    clearingHouse.closePosition(amm.address, toDecimal(78), { from: bob }),
                    "More than maximal quote token",
                )
            })
        })
    })

    describe("pausable functions", () => {
        it("pause by admin", async () => {
            const error = "Pausable: paused"
            await clearingHouse.pause()
            await expectRevert(
                clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(1), toDecimal(1), toDecimal(0)),
                error,
            )
            await expectRevert(clearingHouse.addMargin(amm.address, toDecimal(1)), error)
            await expectRevert(clearingHouse.removeMargin(amm.address, toDecimal(1)), error)
            await expectRevert(clearingHouse.closePosition(amm.address, toDecimal(0)), error)
        })

        it("can't pause by non-admin", async () => {
            await expectRevert(clearingHouse.pause({ from: alice }), "PerpFiOwnableUpgrade: caller is not the owner")
        })

        it("pause then unpause by admin", async () => {
            await quoteToken.approve(clearingHouse.address, toFullDigit(2), { from: alice })
            await clearingHouse.pause()
            await clearingHouse.unpause()
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(1), toDecimal(1), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.addMargin(amm.address, toDecimal(1), {
                from: alice,
            })
            await clearingHouse.removeMargin(amm.address, toDecimal(1), {
                from: alice,
            })
            await clearingHouse.closePosition(amm.address, toDecimal(0), {
                from: alice,
            })
        })

        it("pause by admin and can not being paused by non-admin", async () => {
            await clearingHouse.pause()
            await expectRevert(clearingHouse.pause({ from: alice }), "PerpFiOwnableUpgrade: caller is not the owner")
        })
    })

    describe("restriction mode", () => {
        enum Action {
            OPEN = 0,
            CLOSE = 1,
            LIQUIDATE = 2,
        }

        // copy from above so skip the comment for calculation
        async function makeLiquidatableByShort(addr: string): Promise<void> {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(0), {
                from: admin,
            })
            await forwardBlockTimestamp(15)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(20), toDecimal(5), toDecimal(0), {
                from: addr,
            })
            await forwardBlockTimestamp(15)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                from: admin,
            })
            await forwardBlockTimestamp(15)
        }

        beforeEach(async () => {
            traderWallet1 = await TraderWallet.new(clearingHouse.address, quoteToken.address)
            await transfer(admin, traderWallet1.address, 1000)

            await approve(admin, clearingHouse.address, 1000)
            await approve(alice, clearingHouse.address, 1000)
            await approve(bob, clearingHouse.address, 1000)
            await clearingHouse.setMaintenanceMarginRatio(toDecimal(0.2))
            await clearingHouse.setPartialLiquidationRatio(toDecimal(1))
        })

        it("trigger restriction mode", async () => {
            // just make some trades to make bob's bad debt larger than 0 by checking args[8] of event
            // price become 11.03 after openPosition
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(10), toDecimal(5), toDecimal(0), {
                from: bob,
            })
            await forwardBlockTimestamp(15)
            // price become 7.23 after openPosition
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(10), toDecimal(0), {
                from: alice,
            })
            await forwardBlockTimestamp(15)
            await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })

            const blockNumber = new BigNumber(await clearingHouse.mock_getCurrentBlockNumber())
            expect(await clearingHouse.isInRestrictMode(amm.address, blockNumber)).eq(true)
            expect(await clearingHouse.isInRestrictMode(amm.address, blockNumber.subn(1))).eq(false)
        })

        // there are 3 types of actions, open, close and liquidate
        // So test cases will be combination of any two of them,
        // except close-close because it doesn't make sense.
        it("open then close", async () => {
            await expectRevert(
                traderWallet1.multiActions(
                    Action.OPEN,
                    true,
                    Action.CLOSE,
                    amm.address,
                    Side.BUY,
                    toDecimal(60),
                    toDecimal(10),
                    toDecimal(0),
                    alice,
                ),
                "only one action allowed",
            )
        })

        it("open then open", async () => {
            await expectRevert(
                traderWallet1.multiActions(
                    Action.OPEN,
                    true,
                    Action.OPEN,
                    amm.address,
                    Side.BUY,
                    toDecimal(60),
                    toDecimal(10),
                    toDecimal(0),
                    alice,
                ),
                "only one action allowed",
            )
        })

        it("open then liquidate", async () => {
            await makeLiquidatableByShort(alice)
            await syncAmmPriceToOracle()
            await clearingHouse.liquidate(amm.address, alice)
        })

        it("liquidate then open", async () => {
            await makeLiquidatableByShort(alice)
            await forwardBlockTimestamp(15)
            await syncAmmPriceToOracle()
            await traderWallet1.multiActions(
                Action.LIQUIDATE,
                true,
                Action.OPEN,
                amm.address,
                Side.BUY,
                toDecimal(60),
                toDecimal(10),
                toDecimal(0),
                alice,
            )
        })

        it("failed if open, liquidate then close", async () => {
            await makeLiquidatableByShort(alice)
            await forwardBlockTimestamp(15)
            await traderWallet1.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(5), toDecimal(0))
            await syncAmmPriceToOracle()
            await expectRevert(
                traderWallet1.multiActions(
                    Action.LIQUIDATE,
                    true,
                    Action.CLOSE,
                    amm.address,
                    Side.BUY,
                    toDecimal(60),
                    toDecimal(10),
                    toDecimal(0),
                    alice,
                ),
                "only one action allowed",
            )
        })

        it("liquidate then liquidate", async () => {
            await makeLiquidatableByShort(alice)
            await makeLiquidatableByShort(bob)
            await forwardBlockTimestamp(15)
            await syncAmmPriceToOracle()
            await expectRevert(
                traderWallet1.multiActions(
                    Action.LIQUIDATE,
                    true,
                    Action.LIQUIDATE,
                    amm.address,
                    Side.BUY,
                    toDecimal(60),
                    toDecimal(10),
                    toDecimal(0),
                    alice,
                ),
                "positionSize is 0",
            )
        })

        it("close then liquidate", async () => {
            // avoid two actions from exceeding the fluctuation limit
            await amm.setFluctuationLimitRatio(toDecimal(0.5))

            await makeLiquidatableByShort(alice)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(1), toDecimal(0), {
                from: bob,
            })
            await forwardBlockTimestamp(15)
            await clearingHouse.closePosition(amm.address, toDecimal(0))
            await syncAmmPriceToOracle()
            await clearingHouse.liquidate(amm.address, alice)
        })

        it("force error, close then liquidate then open", async () => {
            // avoid actions from exceeding the fluctuation limit
            await amm.setFluctuationLimitRatio(toDecimal(0.5))

            await makeLiquidatableByShort(alice)
            await traderWallet1.openPosition(amm.address, Side.SELL, toDecimal(5), toDecimal(1), toDecimal(0))
            await forwardBlockTimestamp(15)
            await traderWallet1.closePosition(amm.address)
            await syncAmmPriceToOracle()
            await expectRevert(
                traderWallet1.multiActions(
                    Action.LIQUIDATE,
                    true,
                    Action.OPEN,
                    amm.address,
                    Side.BUY,
                    toDecimal(60),
                    toDecimal(10),
                    toDecimal(0),
                    alice,
                ),
                "only one action allowed",
            )
        })

        it("close then open", async () => {
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(1), toDecimal(1), toDecimal(0))
            await forwardBlockTimestamp(15)
            await clearingHouse.closePosition(amm.address, toDecimal(0))
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(1), toDecimal(1), toDecimal(0))
        })
    })

    describe("openPosition & closePosition with referral code", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 1000)
            await approve(bob, clearingHouse.address, 1000)
        })

        it("openPosition with referral code", async () => {
            const receipt = await clearingHouse.openPositionWithReferral(
                amm.address,
                Side.BUY,
                toDecimal(50),
                toDecimal(1),
                toDecimal(0),
                toBytes32("Hello world"),
                {
                    from: alice,
                },
            )

            await expectEvent.inTransaction(receipt.tx, clearingHouse, "ReferredPositionChanged", {
                referralCode: toBytes32("Hello world"),
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "PositionChanged", {
                trader: alice,
                amm: amm.address,
                margin: toFullDigit(50),
            })
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(50))
        })

        it("force error, openPosition without referral code", async () => {
            const receipt = await clearingHouse.openPositionWithReferral(
                amm.address,
                Side.BUY,
                toDecimal(25),
                toDecimal(2),
                toDecimal(0),
                EMPTY_STRING_IN_BYTES32,
                {
                    from: alice,
                },
            )

            await expectEvent.not.inTransaction(receipt.tx, clearingHouse, "ReferredPositionChanged")
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(25))
        })

        it("closePosition with referral code", async () => {
            await clearingHouse.openPositionWithReferral(
                amm.address,
                Side.BUY,
                toDecimal(50),
                toDecimal(1),
                toDecimal(0),
                toBytes32("Hello world"),
                {
                    from: alice,
                },
            )

            const receipt = await clearingHouse.closePositionWithReferral(
                amm.address,
                toDecimal(0),
                toBytes32("Hello world"),
                { from: alice },
            )

            await expectEvent.inTransaction(receipt.tx, clearingHouse, "ReferredPositionChanged", {
                referralCode: toBytes32("Hello world"),
            })
            expect((await clearingHouse.getPosition(amm.address, alice)).margin).to.eq(toFullDigit(0))
        })

        it("force error, closePosition without referral code", async () => {
            await clearingHouse.openPositionWithReferral(
                amm.address,
                Side.BUY,
                toDecimal(50),
                toDecimal(1),
                toDecimal(0),
                toBytes32("Hello world"),
                {
                    from: alice,
                },
            )

            const receipt = await clearingHouse.closePositionWithReferral(
                amm.address,
                toDecimal(0),
                EMPTY_STRING_IN_BYTES32,
                { from: alice },
            )
            await expectEvent.not.inTransaction(receipt.tx, clearingHouse, "ReferredPositionChanged")
        })
    })
})
