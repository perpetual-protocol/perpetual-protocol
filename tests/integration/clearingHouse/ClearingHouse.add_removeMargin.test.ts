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

    describe("remove margin with unrealized PnL", () => {
        beforeEach(async () => {
            await approve(alice, clearingHouse.address, 2000)
            await approve(bob, clearingHouse.address, 2000)
        })

        describe("using spot price", () => {
            it("remove margin when a long position with profit", async () => {
                // reserve 1000 : 100
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                // reserve 1300 : 76.92, price = 16.9

                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                // reserve 1600 : 62.5, price = 25.6

                // margin: 60
                // positionSize: 23.08
                // positionNotional: 431.5026875438
                // unrealizedPnl: 431.5026875438 - 300 = 131.5026875438
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(60, 60 + 131.5026875438) - 431.5 * 0.05 = 38.425
                // can not remove margin > 38.425
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(38.5), { from: alice }),
                    "free collateral is not enough",
                )
                const freeCollateral = await clearingHouseViewer.getFreeCollateral(amm.address, alice)
                expect(freeCollateral).to.eq("38426966292134831461")
                await clearingHouse.removeMargin(amm.address, freeCollateral, { from: alice })
            })

            it("remove margin when a long position with loss", async () => {
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                // reserve 1300 : 76.92, price = 16.9

                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                // reserve 1250 : 80 price = 15.625

                // margin: 60
                // positionSize: 23.08
                // positionNotional: 279.88
                // unrealizedPnl: 279.88 - 300 =  -20.12
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(60, 60 + (-20.12)) - 279.88 * 0.05 = 25.886
                // can not remove margin > 25.886
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(26), { from: alice }),
                    "free collateral is not enough",
                )
                const freeCollateral = await clearingHouseViewer.getFreeCollateral(amm.address, alice)
                expect(freeCollateral).to.eq("25858208955223880594")
                await clearingHouse.removeMargin(amm.address, freeCollateral, { from: alice })
            })

            it("remove margin when a short position with profit", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                // reserve 900 : 111.11, price = 8.1
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                // reserve 800 : 125, price = 6.4

                // margin: 20
                // positionSize: -11.11
                // positionNotional: 78.04
                // unrealizedPnl: 100 - 78.04 = 21.96
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(20, 20 + 21.96) - 78.04 * 0.05 = 16.098
                // can not remove margin > 16.098
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(16.5), { from: alice }),
                    "free collateral is not enough",
                )
                const freeCollateral = await clearingHouseViewer.getFreeCollateral(amm.address, alice)
                expect(freeCollateral).to.eq("16097560975609756098")
                await clearingHouse.removeMargin(amm.address, freeCollateral, { from: alice })
            })

            it("remove margin when a short position with loss", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(10), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                // reserve 800 : 125, price = 6.4

                // margin: 20
                // positionSize: -11.11
                // positionNotional: 112.1
                // unrealizedPnl: 100 - 112.1 = -12.1
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(20, 20 + (-12.1)) - 112.1 * 0.05 = 2.295
                // can not remove margin > 2.295
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(2.5), { from: alice }),
                    "free collateral is not enough",
                )
                const freeCollateral = await clearingHouseViewer.getFreeCollateral(amm.address, alice)
                expect(freeCollateral).to.eq("2282608695652173905")
                await clearingHouse.removeMargin(amm.address, freeCollateral, { from: alice })
            })
        })

        describe("using twap", () => {
            it("remove margin when a long position with profit", async () => {
                // reserve 1000 : 100
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await forwardBlockTimestamp(450)
                // reserve 1300 : 76.92, price = 16.9

                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await forwardBlockTimestamp(450)
                // reserve 1600 : 62.5, price = 25.6

                // margin: 60
                // positionSize: 23.08
                // positionNotional: (300 + 431.5) / 2 = 365.75
                // unrealizedPnl: 365.75 - 300 = 65.75
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(60, 60 + 65.75) - 365.75 * 0.05 = 41.7125
                // can not remove margin > 41.7125
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(42), { from: alice }),
                    "free collateral is not enough",
                )
                await clearingHouse.removeMargin(amm.address, toDecimal(41.712), { from: alice })
            })

            it("remove margin when a long position with loss", async () => {
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(60), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await forwardBlockTimestamp(450)
                // reserve 1300 : 76.92, price = 16.9

                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(10), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await forwardBlockTimestamp(450)
                // reserve 1250 : 80 price = 15.625
                // push the price up, so that CH uses twap to calculate the loss
                await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })

                // margin: 60
                // positionSize: 23.08
                // positionNotional: (300 + 279.88) / 2 = 289.94
                // unrealizedPnl: 289.94 - 300 =  -10.06
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(60, 60 + (-10.06)) - 289.94 * 0.05 = 35.443
                // can not remove margin > 35.443
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(35.5), { from: alice }),
                    "free collateral is not enough",
                )
                await clearingHouse.removeMargin(amm.address, toDecimal(35.4), { from: alice })
            })

            it("remove margin when a short position with profit", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await forwardBlockTimestamp(450)
                // reserve 900 : 111.11, price = 8.1
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await forwardBlockTimestamp(450)
                // reserve 800 : 125, price = 6.4

                // margin: 20
                // positionSize: -11.11
                // positionNotional: (78.04 + 100) / 2 = 89.02
                // unrealizedPnl: 100 - 89.02 = 10.98
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(20, 20 + 10.98) - 89.02 * 0.05 = 15.549
                // can not remove margin > 15.549
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(15.6), { from: alice }),
                    "free collateral is not enough",
                )
                await clearingHouse.removeMargin(amm.address, toDecimal(15.5), { from: alice })
            })

            it("remove margin when a short position with loss", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(20), toDecimal(5), toDecimal(0), {
                    from: alice,
                })
                await forwardBlockTimestamp(450)
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(10), toDecimal(5), toDecimal(0), {
                    from: bob,
                })
                await forwardBlockTimestamp(450)
                // reserve 800 : 125, price = 6.4

                // pull the price down, so that CH uses twap to calculate the loss
                await clearingHouse.closePosition(amm.address, toDecimal(0), { from: bob })

                // margin: 20
                // positionSize: -11.11
                // positionNotional: (112.1 + 100) / 2 = 106.05
                // unrealizedPnl: 100 - 106.05 = -6.05
                // min(margin + funding, margin + funding + unrealized PnL) - position value * 5%
                // min(20, 20 + (-6.05)) - 106.05 * 0.05 = 8.6475
                // can not remove margin > 8.6475
                await expectRevert(
                    clearingHouse.removeMargin(amm.address, toDecimal(8.7), { from: alice }),
                    "free collateral is not enough",
                )
                await clearingHouse.removeMargin(amm.address, toDecimal(8.6), { from: alice })
            })
        })
    })
})
