import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BigNumber } from "bn.js"
import { expect, use } from "chai"
import { artifacts, web3 } from "hardhat"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ClearingHouseViewerInstance,
    ERC20FakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    RewardsDistributionFakeInstance,
    SupplyScheduleFakeInstance,
    TraderWalletContract,
} from "../../../types/truffle"
import { assertionHelper } from "../../helper/assertion-plugin"
import { Side } from "../../helper/contract"
import { fullDeploy } from "../../helper/deploy"
import { toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

const TraderWallet = artifacts.require("TraderWallet") as TraderWalletContract
const EMPTY_STRING_IN_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

describe("ClearingHouse add/remove margin Test", () => {
    let addresses: string[]
    let admin: string
    let alice: string
    let bob: string

    let amm: AmmFakeInstance
    let insuranceFund: InsuranceFundFakeInstance
    let quoteToken: ERC20FakeInstance
    let mockPriceFeed!: L2PriceFeedMockInstance
    let rewardsDistribution: RewardsDistributionFakeInstance
    let clearingHouse: ClearingHouseFakeInstance
    let clearingHouseViewer: ClearingHouseViewerInstance
    let supplySchedule: SupplyScheduleFakeInstance

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

    async function approve(account: string, spender: string, amount: number): Promise<void> {
        await quoteToken.approve(spender, toFullDigit(amount, +(await quoteToken.decimals())), { from: account })
    }

    async function transfer(from: string, to: string, amount: number): Promise<void> {
        await quoteToken.transfer(to, toFullDigit(amount, +(await quoteToken.decimals())), { from })
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

        const contracts = await fullDeploy({ sender: admin })
        amm = contracts.amm
        insuranceFund = contracts.insuranceFund
        quoteToken = contracts.quoteToken
        mockPriceFeed = contracts.priceFeed
        rewardsDistribution = contracts.rewardsDistribution
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

    describe("add/remove margin", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 2000)
            await approve(bob, clearingHouse.address, 2000)
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(10), toDecimal(37.5), {
                from: alice,
            })
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

        it("add margin even if there is no position opened yet", async () => {
            const r = await clearingHouse.addMargin(amm.address, toDecimal(1), { from: bob })
            expectEvent.inTransaction(r.tx, clearingHouse, "MarginChanged")
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

        it("remove margin - no position opened yet but there is margin (edge case)", async () => {
            await clearingHouse.addMargin(amm.address, toDecimal(1), { from: bob })

            const receipt = await clearingHouse.removeMargin(amm.address, toDecimal(1), {
                from: bob,
            })
            await expectEvent.inTransaction(receipt.tx, clearingHouse, "MarginChanged", {
                sender: bob,
                amm: amm.address,
                amount: toFullDigit(-1),
                fundingPayment: "0",
            })
        })

        it("force error, remove margin - no enough margin", async () => {
            // margin is 60, try to remove more than 60
            const removedMargin = 61

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "margin is not enough",
            )
        })

        it("force error, remove margin - no enough margin ratio (4%)", async () => {
            const removedMargin = 36

            // min(margin + funding, margin + funding + unrealized PnL) - position value * 10%
            // min(60 - 36, 60 - 36) - 600 * 0.1 = -24
            // remove margin 36
            // remain margin -> 60 - 36 = 24
            // margin ratio -> 24 / 600 = 4%
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(removedMargin), { from: alice }),
                "free collateral is not enough",
            )
        })

        it("force error, remove margin - no position opened yet and neither is there any margin", async () => {
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "margin is not enough",
            )
        })
    })

    describe.only("remove margin with unrealized PnL", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 2000)
            await approve(bob, clearingHouse.address, 2000)
            // await mockPriceFeed.setTwapPrice(toFullDigit(10))
        })

        it.only("force error, remove margin when a long position with profit", async () => {
            // reserve 1000 : 100
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: alice,
            })
            // reserve 1300 : 76.92, price = 16.9

            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: bob,
            })
            // reserve 1600 : 62.5, price = 25.6
            await mockPriceFeed.setTwapPrice(toFullDigit(30))

            // margin: 60
            // positionSize: 23.08
            // positionNotional: 431.5026875438
            // unrealizedPnl: 431.5026875438 - 300 = 131.5026875438
            // min(margin + funding, margin + funding + unrealized PnL) - position value * 10%
            // min(60, 60 + 131.5026875438) - 431.5 * 0.1 = 16.85
            // can not remove margin > 16.85
            console.log((await clearingHouse.getFreeCollateral(amm.address, alice)).d.toString())
            // 38426966292134831461
            const pos = await clearingHouse.getPosition(amm.address, alice)
            console.log(pos.margin.d.toString(), pos.size.d.toString(), pos.openNotional.d.toString())
            // 60000000000000000000 23076923076923076923 300000000000000000000
            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(17), { from: alice }),
                "free collateral is not enough",
            )
        })

        it("force error, remove margin when a long position with loss", async () => {
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: alice,
            })
            // min(margin + funding, margin + funding + unrealized PnL) - position value * 10%
            // min(60, 60 + (-??)) -
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(120), toDecimal(5), toDecimal(0), {
                from: bob,
            })
            console.log(await (await amm.getSpotPrice()).d.toString())

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "free collateral is not enough",
            )
        })
        it("force error, remove margin when a short position with profit", async () => {
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: bob,
            })
            console.log(await (await amm.getSpotPrice()).d.toString())

            // min(margin + funding, margin + funding + unrealized PnL) - position value * 10%
            // min(60, 60 + (-??)) -

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "free collateral is not enough",
            )
        })

        it("force error, remove margin when a short position with loss", async () => {
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: alice,
            })
            await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                from: bob,
            })
            console.log(await (await amm.getSpotPrice()).d.toString())

            // min(margin + funding, margin + funding + unrealized PnL) - position value * 10%
            // min(60, 60 + (-??)) -

            await expectRevert(
                clearingHouse.removeMargin(amm.address, toDecimal(1), { from: bob }),
                "free collateral is not enough",
            )
        })
    })
})
