import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BN } from "bn.js"
import { use } from "chai"
import { utils } from "ethers"
import {
    AmmFakeInstance,
    ClearingHouseFakeInstance,
    ERC20FakeInstance,
    InflationMonitorFakeInstance,
    InsuranceFundFakeInstance,
    L2PriceFeedMockInstance,
    MinterInstance,
    PerpTokenInstance,
    StakingReserveFakeInstance,
    SupplyScheduleFakeInstance,
} from "../../../types"
import { assertionHelper } from "../../helper/assertion-plugin"
import { deployAmm, deployErc20Fake, Dir, Side } from "../../helper/contract"
import { fullDeploy } from "../../helper/deploy"
import { fromDecimal, ONE_DAY, toDecimal, toFullDigit } from "../../helper/number"

use(assertionHelper)

// TODO move out from clearingHouse folder
describe("Protocol shutdown test", () => {
    let admin: string
    let alice: string
    let bob: string
    let carol: string
    let chad: string
    let clearingHouse: ClearingHouseFakeInstance
    let amm: AmmFakeInstance
    let quoteToken: ERC20FakeInstance
    let insuranceFund: InsuranceFundFakeInstance
    let mockPriceFeed!: L2PriceFeedMockInstance
    let supplySchedule: SupplyScheduleFakeInstance
    let perpToken: PerpTokenInstance
    let inflationMonitor: InflationMonitorFakeInstance
    let stakingReserve: StakingReserveFakeInstance
    let minter: MinterInstance

    async function deployAmmPair(quoteToken?: ERC20FakeInstance): Promise<any> {
        const quote = quoteToken || (await deployErc20Fake(toFullDigit(20000000), "DAI", "DAI"))
        const amm = await deployAmm({
            deployer: admin,
            quoteAssetTokenAddr: quote.address,
            priceFeedAddr: mockPriceFeed.address,
            fundingPeriod: new BN(86400),
            fluctuation: toFullDigit(0),
        })
        await amm.setGlobalShutdown(insuranceFund.address)
        await amm.setCounterParty(clearingHouse.address)
        await amm.setOpen(true)

        return { quote, amm }
    }

    async function approve(account: string, spender: string, amount: number | string): Promise<void> {
        await quoteToken.approve(spender, toFullDigit(amount, +(await quoteToken.decimals())), { from: account })
    }

    async function transfer(from: string, to: string, amount: number | string): Promise<void> {
        await quoteToken.transfer(to, toFullDigit(amount, +(await quoteToken.decimals())), { from })
    }

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]
        bob = addresses[2]
        carol = addresses[3]
        chad = addresses[4]

        const contracts = await fullDeploy({
            sender: admin,
            quoteAssetReserve: toFullDigit(10000),
            baseAssetReserve: toFullDigit(100),
        })
        clearingHouse = contracts.clearingHouse
        clearingHouse = contracts.clearingHouse
        amm = contracts.amm
        quoteToken = contracts.quoteToken
        insuranceFund = contracts.insuranceFund
        mockPriceFeed = contracts.priceFeed
        supplySchedule = contracts.supplySchedule
        perpToken = contracts.perpToken
        inflationMonitor = contracts.inflationMonitor
        stakingReserve = contracts.stakingReserve
        minter = contracts.minter
    })

    describe("global shutdown test", () => {
        let amm2: AmmFakeInstance

        async function forwardBlockTimestamp(time = 15): Promise<void> {
            const now = await supplySchedule.mock_getCurrentTimestamp()

            await inflationMonitor.mock_setBlockTimestamp(now.addn(time))
            await supplySchedule.mock_setBlockTimestamp(now.addn(time))
            const movedBlocks = time / 15 < 1 ? 1 : time / 15
            const blockNumber = await amm.mock_getCurrentBlockNumber()
            await inflationMonitor.mock_setBlockNumber(blockNumber.addn(movedBlocks))
            await supplySchedule.mock_setBlockNumber(blockNumber.addn(movedBlocks))
        }

        async function gotoNextMintTime(): Promise<void> {
            const nextMintTime = await supplySchedule.nextMintTime()
            await supplySchedule.mock_setBlockTimestamp(nextMintTime)
            await inflationMonitor.mock_setBlockTimestamp(nextMintTime)
        }

        async function mint(times = 1): Promise<void> {
            for (let i = 0; i < times; i++) {
                await gotoNextMintTime()
                await minter.mintReward()
            }
        }

        beforeEach(async () => {
            const set2 = await deployAmmPair()
            amm2 = set2.amm

            await insuranceFund.addAmm(amm2.address)
            await amm2.setTollRatio(toDecimal(0.05))
            await amm2.setSpreadRatio(toDecimal(0.05))

            await transfer(admin, alice, 1000)
            await approve(alice, clearingHouse.address, 1000)

            // given an init mint history
            await minter.setInsuranceFund(admin)
            await minter.mintForLoss({ d: "1" })
        })

        it("weekly minted perp token is more than 10%", async () => {
            // mint totalSupply * 0.125
            // 0.125 / (1 + 0.125) ~= 11.1%
            const supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(8).toString() })

            await forwardBlockTimestamp(7 * ONE_DAY)

            const r = await insuranceFund.shutdownAllAmm()
            await expectEvent.inTransaction(r.tx, insuranceFund, "ShutdownAllAmms")
            expect(await amm2.open()).to.eq(false)
        })

        it("can immediately shutdown if minted perp token is more than 10%", async () => {
            // mint totalSupply * 0.125
            // 0.125 / (1 + 0.125) ~= 11.1%
            const supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(8).toString() })

            const r = await insuranceFund.shutdownAllAmm()
            await expectEvent.inTransaction(r.tx, insuranceFund, "ShutdownAllAmms")
            expect(await amm2.open()).to.eq(false)
        })

        it("cumulative minted perp token in a week is more than 10%", async () => {
            // mint totalSupply * 0.125
            // 0.125 / (1 + 0.125) ~= 11.1%
            const supply = await perpToken.totalSupply()
            const mintedAmount = supply.divn(8).divn(3)
            await minter.mintForLoss({ d: mintedAmount.toString() })
            await forwardBlockTimestamp(2 * ONE_DAY)
            await minter.mintForLoss({ d: mintedAmount.toString() })
            await forwardBlockTimestamp(2 * ONE_DAY)
            await minter.mintForLoss({ d: mintedAmount.toString() })
            await forwardBlockTimestamp(3 * ONE_DAY)

            const r = await insuranceFund.shutdownAllAmm()
            await expectEvent.inTransaction(r.tx, insuranceFund, "ShutdownAllAmms")
            expect(await amm2.open()).to.eq(false)
        })

        it("not reach 10% criteria, still can trade", async () => {
            // mint totalSupply * 0.111
            // 0.111 / (1 + 0.111) ~= 9.9%
            const supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(9).toString() })
            await insuranceFund.shutdownAllAmm()
            const receipt = await clearingHouse.openPosition(
                amm.address,
                Side.BUY,
                toDecimal(100),
                toDecimal(1),
                toDecimal(0),
                {
                    from: alice,
                },
            )
            expectEvent(receipt, "PositionChanged")
        })

        it("minted perp token is less than 10% in a week but more than 10% at (now - 8days), still can trade", async () => {
            // mint totalSupply * 0.125
            // 0.125 / (1 + 0.125) ~= 11.1%
            let supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(8).toString() })
            await forwardBlockTimestamp(3 * ONE_DAY)

            supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(20).toString() })
            await forwardBlockTimestamp(3 * ONE_DAY)

            supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(8).toString() })
            await forwardBlockTimestamp(2 * ONE_DAY)

            expectEvent(
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "PositionChanged",
            )
        })

        it("a week ago, minted perp token is more than 10%, still can trade", async () => {
            // mint totalSupply * 0.125
            // 0.125 / (1 + 0.125) ~= 11.1%
            const supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(8).toString() })
            await forwardBlockTimestamp(7 * ONE_DAY + 1)

            expectEvent(
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "PositionChanged",
            )
        })

        it("change threshold to 5%", async () => {
            await inflationMonitor.setShutdownThreshold(toDecimal(0.05))
            const supply = await perpToken.totalSupply()

            // mint totalSupply * 0.05
            // 0.05 / (1 + 0.05) ~= 4.7%, still can trade
            await minter.mintForLoss({ d: supply.divn(20).toString() })
            await insuranceFund.shutdownAllAmm()
            expectEvent(
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "PositionChanged",
            )

            await forwardBlockTimestamp(7 * ONE_DAY + 1)

            // mint totalSupply * 0.111
            // 0.111 / (1 + 0.111) ~= 9.9%
            const supplyNew = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supplyNew.divn(9).toString() })
            const r = await insuranceFund.shutdownAllAmm()
            await expectEvent.inTransaction(r.tx, insuranceFund, "ShutdownAllAmms")
            expect(await amm2.open()).to.eq(false)
        })

        it("mintReward should not affect the criteria", async () => {
            // 1% inflation rate
            await mint()
            await forwardBlockTimestamp(2 * ONE_DAY)

            // mint totalSupply * 0.111
            // 0.111 / (1 + 0.111) ~= 9.9%
            const supply = await perpToken.totalSupply()
            await minter.mintForLoss({ d: supply.divn(9).toString() })
            await insuranceFund.shutdownAllAmm()

            expectEvent(
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                }),
                "PositionChanged",
            )
        })
    })

    describe("shutdown Amm test", () => {
        beforeEach(async () => {
            await transfer(admin, alice, 100)
            await approve(alice, clearingHouse.address, 100)
            await transfer(admin, insuranceFund.address, 5000)
        })

        it("close amm", async () => {
            expect(await amm.open()).eq(true)
            const receipt = await clearingHouse.openPosition(
                amm.address,
                Side.SELL,
                toDecimal(100),
                toDecimal(2),
                toDecimal(0),
                { from: alice },
            )
            expectEvent(receipt, "PositionChanged")

            await amm.shutdown()

            expect(await amm.open()).eq(false)
            expect(await amm.getSettlementPrice()).to.not.eq(0)

            const error = "amm was closed"
            await expectRevert(
                clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: bob,
                }),
                error,
            )
            await expectRevert(clearingHouse.closePosition(amm.address, toDecimal(0), { from: alice }), error)
            await expectRevert(clearingHouse.addMargin(amm.address, toDecimal(10), { from: alice }), error)
            await expectRevert(clearingHouse.removeMargin(amm.address, toDecimal(10), { from: alice }), error)
            await expectRevert(clearingHouse.payFunding(amm.address, { from: alice }), error)
            await expectRevert(clearingHouse.liquidate(amm.address, alice, { from: carol }), error)
        })

        it("close amm1 should not affect amm2", async () => {
            // add amm2
            const set2 = await deployAmmPair()
            const amm2 = set2.amm as AmmFakeInstance
            const quote2 = set2.quote as ERC20FakeInstance
            await quote2.transfer(alice, toFullDigit(100))
            await quote2.approve(clearingHouse.address, toFullDigit(100), { from: alice })
            await quote2.transfer(insuranceFund.address, toFullDigit(5000))

            await amm2.setSpreadRatio(toDecimal(0.05))
            await amm2.setTollRatio(toDecimal(0.05))
            await insuranceFund.addAmm(amm2.address)
            await amm2.setTollRatio(toDecimal(0.5))
            await amm2.setSpreadRatio(toDecimal(0.5))

            // shutdown amm
            await amm.shutdown()

            expect(await amm.open()).eq(false)
            expect(await amm2.open()).eq(true)

            const r = await clearingHouse.openPosition(
                amm2.address,
                Side.SELL,
                toDecimal(10),
                toDecimal(2),
                toDecimal(0),
                { from: alice },
            )
            expectEvent(r, "PositionChanged")
        })

        it("settle twice", async () => {
            expect(await amm.open()).eq(true)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(2), toDecimal(0), {
                from: alice,
            })

            await amm.shutdown()

            const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
            await expectEvent.inTransaction(aliceReceipt.tx, quoteToken, "Transfer")
            await expectRevert(clearingHouse.settlePosition(amm.address, { from: alice }), "positionSize is 0")
        })

        it("force error, amm is open", async () => {
            expect(await amm.open()).eq(true)
            await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(2), toDecimal(0), {
                from: alice,
            })

            await expectRevert(clearingHouse.settlePosition(amm.address, { from: alice }), "amm is open")
        })

        describe("how much refund trader can get", () => {
            beforeEach(async () => {
                await transfer(admin, bob, 100)
                await approve(bob, clearingHouse.address, 100)
                await transfer(admin, carol, 100)
                await approve(carol, clearingHouse.address, 100)
            })

            it("get their collateral if settlements price is 0", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: alice,
                })
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: bob,
                })
                const receipt = await amm.shutdown()
                await expectEvent.inTransaction(receipt.tx, amm, "Shutdown", {
                    settlementPrice: "0",
                })

                // then alice get her total collateral
                const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
                await expectEvent.inTransaction(aliceReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: alice,
                    value: toFullDigit(100, +(await quoteToken.decimals())),
                })

                // then bob get her total collateral
                const bobReceipt = await clearingHouse.settlePosition(amm.address, { from: bob })
                await expectEvent.inTransaction(bobReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: bob,
                    value: toFullDigit(100, +(await quoteToken.decimals())),
                })
            })

            it("get trader's collateral back as closing position in average price", async () => {
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: alice,
                })
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: bob,
                })
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: carol,
                })
                const receipt = await amm.shutdown()
                await expectEvent.inTransaction(receipt.tx, amm, "Shutdown", {
                    settlementPrice: "98999999999999999804",
                })

                const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
                await expectEvent.inTransaction(aliceReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: alice,
                    value: "97959183",
                })

                const bobReceipt = await clearingHouse.settlePosition(amm.address, { from: bob })
                await expectEvent.inTransaction(bobReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: bob,
                    value: "102040816",
                })

                const carolReceipt = await clearingHouse.settlePosition(amm.address, { from: carol })
                await expectEvent.inTransaction(carolReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: carol,
                    value: "100000000",
                })
            })

            it("get trader's collateral back after migrate liquidity then shutdown amm and settlement price is 0", async () => {
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                })
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: bob,
                })
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: carol,
                })

                // after migrate liquidity, total position = 15.151515
                await amm.migrateLiquidity(toDecimal(2))
                const totalPositionSize = await amm.totalPositionSize()
                const dir = totalPositionSize.isNeg() ? Dir.REMOVE_FROM_AMM : Dir.ADD_TO_AMM
                const totalPositionNotional = await amm.getOutputPrice(dir, { d: totalPositionSize.toString() })

                const chadAmount = utils.formatEther(totalPositionNotional.toString())
                await transfer(admin, chad, chadAmount)
                await approve(chad, clearingHouse.address, chadAmount)

                // chad openPosition to make totalPosition = 0
                await clearingHouse.openPosition(
                    amm.address,
                    Side.SELL,
                    totalPositionNotional,
                    toDecimal(1),
                    toDecimal(0),
                    {
                        from: chad,
                    },
                )

                const receipt = await amm.shutdown()
                await expectEvent.inTransaction(receipt.tx, amm, "Shutdown", {
                    settlementPrice: "0",
                })

                const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
                await expectEvent.inTransaction(aliceReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: alice,
                    value: toFullDigit(100, +(await quoteToken.decimals())),
                })

                const bobReceipt = await clearingHouse.settlePosition(amm.address, { from: bob })
                await expectEvent.inTransaction(bobReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: bob,
                    value: toFullDigit(100, +(await quoteToken.decimals())),
                })

                const carolReceipt = await clearingHouse.settlePosition(amm.address, { from: carol })
                await expectEvent.inTransaction(carolReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: carol,
                    value: toFullDigit(100, +(await quoteToken.decimals())),
                })

                const chadReceipt = await clearingHouse.settlePosition(amm.address, { from: chad })
                await expectEvent.inTransaction(chadReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: chad,
                    value: fromDecimal(totalPositionNotional, +(await quoteToken.decimals())),
                })

                expect(await quoteToken.balanceOf(clearingHouse.address)).eq(0)
            })

            it("get trader's collateral back after migrate liquidity ", async () => {
                await transfer(admin, chad, 100)
                await approve(chad, clearingHouse.address, 100)

                // position size: 0.99
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: alice,
                })
                // position size: 1.92
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(100), toDecimal(2), toDecimal(0), {
                    from: bob,
                })
                // position size: -0.95
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(1), toDecimal(0), {
                    from: carol,
                })
                // total position size 1.96

                // Amm reserve 10200 : 98.04 --> 20400 : 196.08
                // migrated position size = 1.94
                await amm.migrateLiquidity(toDecimal(2))

                // get -2.93 positions
                // Amm: 20100 : 199
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(100), toDecimal(3), toDecimal(0), {
                    from: chad,
                })
                // total position size = 1.94 + (-2.93) = -0.985

                // notional value (10000(init value of original curve) * 2(migration multiplier) - 20100) = -100
                // settle price should be -100 / -0.985 = 101.505
                const receipt = await amm.shutdown()
                expect(await amm.getSettlementPrice()).to.eq("101504999999999999991")

                // position value = 100(open notional) / 0.956(migrated position size) = 104.6
                // 0.956 * (101.51 - 104.6) + 100 = 97.04
                const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
                await expectEvent.inTransaction(aliceReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: alice,
                    value: "97039699",
                })

                // position value = 200(open notional) / 1.85(migrated position size) = 108.12
                // 1.85 * (101.5 - 108.12) + 100 = 87.5
                const bobReceipt = await clearingHouse.settlePosition(amm.address, { from: bob })
                await expectEvent.inTransaction(bobReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: bob,
                    value: "87552381",
                })

                // position value = 100(open notional) / 0.93(migrated position size) = 107.76
                // -0.93 * (101.5 - 107.76) + 100 = 105.80
                const carolReceipt = await clearingHouse.settlePosition(amm.address, { from: carol })
                await expectEvent.inTransaction(carolReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: carol,
                    value: "105795847",
                })

                // position value = 300(open notional) / 2.93(migrated position size) = 102.39
                // -2.93 * (101.5 - 102.39) + 100 = 102.9
                const chadReceipt = await clearingHouse.settlePosition(amm.address, { from: chad })
                await expectEvent.inTransaction(chadReceipt.tx, quoteToken, "Transfer", {
                    from: clearingHouse.address,
                    to: chad,
                    value: "102941176",
                })
            })

            it("debt is more than clearingHouse' balance, insuranceFund won't pay for it", async () => {
                await transfer(admin, alice, 100)
                await approve(alice, clearingHouse.address, 200)
                await transfer(admin, bob, 100)
                await approve(bob, clearingHouse.address, 200)
                await transfer(admin, carol, 100)
                await approve(carol, clearingHouse.address, 200)

                // open price 80, position size -25
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(200), toDecimal(10), toDecimal(0), {
                    from: alice,
                })
                // open price 67.2, position size 5.95
                await clearingHouse.openPosition(amm.address, Side.BUY, toDecimal(200), toDecimal(2), toDecimal(0), {
                    from: bob,
                })
                // open price 53.76, position size -37.2
                await clearingHouse.openPosition(amm.address, Side.SELL, toDecimal(200), toDecimal(10), toDecimal(0), {
                    from: carol,
                })
                await amm.shutdown()

                // balance of clearingHouse is 600
                // alice should get 600, bob should get 180.95, carol losses 180.95 (can not get collateral back)
                const aliceReceipt = await clearingHouse.settlePosition(amm.address, { from: alice })
                expect(await quoteToken.balanceOf(alice)).to.eq("600000000")

                await expectRevert(
                    clearingHouse.settlePosition(amm.address, { from: bob }),
                    "VM Exception while processing transaction: revert DecimalERC20: transfer failed",
                )
                const r = await clearingHouse.settlePosition(amm.address, { from: carol })
                expectEvent.inTransaction(r.tx, clearingHouse, "PositionSettled", { valueTransferred: "0" })

                expect(await quoteToken.balanceOf(clearingHouse.address)).eq(0)
            })
        })
    })
})
