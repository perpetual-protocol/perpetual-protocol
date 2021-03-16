import { web3 } from "hardhat"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { default as BigNumber, default as BN } from "bn.js"
import { expect, use } from "chai"
import { AmmFakeInstance, ERC20FakeInstance, L2PriceFeedMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployAmm, deployErc20Fake, deployL2MockPriceFeed, Dir } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

describe.only("Amm Unit Test", () => {
    const ETH_PRICE = 100

    let amm: AmmFakeInstance
    let priceFeed: L2PriceFeedMockInstance
    let quoteToken: ERC20FakeInstance
    let admin: string
    let alice: string
    let fundingPeriod: BN
    let fundingBufferPeriod: BN

    async function moveToNextBlocks(number: number = 1): Promise<void> {
        const blockNumber = new BigNumber(await amm.mock_getCurrentBlockNumber())
        await amm.mock_setBlockNumber(blockNumber.addn(number))
    }

    async function forward(seconds: number): Promise<void> {
        const timestamp = new BigNumber(await amm.mock_getCurrentTimestamp())
        await amm.mock_setBlockTimestamp(timestamp.addn(seconds))
        const movedBlocks = seconds / 15 < 1 ? 1 : seconds / 15
        await moveToNextBlocks(movedBlocks)
    }

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        priceFeed = await deployL2MockPriceFeed(toFullDigit(ETH_PRICE))
        quoteToken = await deployErc20Fake(toFullDigit(20000000))
        amm = await deployAmm({
            deployer: admin,
            quoteAssetTokenAddr: quoteToken.address,
            priceFeedAddr: priceFeed.address,
            fluctuation: toFullDigit(0),
            fundingPeriod: new BN(3600), // 1 hour
        })
        await amm.setCounterParty(admin)

        fundingPeriod = await amm.fundingPeriod()
        fundingBufferPeriod = await amm.fundingBufferPeriod()
    })

    describe("default value", () => {
        it("updated after amm added", async () => {
            const liquidityChangedSnapshot = await amm.getLiquidityChangedSnapshots(0)
            expect(liquidityChangedSnapshot.quoteAssetReserve).eq(toFullDigit(1000))
            expect(liquidityChangedSnapshot.baseAssetReserve).eq(toFullDigit(100))
            expect(liquidityChangedSnapshot.cumulativeNotional).eq(0)
        })
    })

    describe("setOpen", () => {
        it("admin open amm", async () => {
            await amm.setOpen(true)
            expect(await amm.open()).is.true
        })

        it("init nextFundingTime is 0", async () => {
            expect(await amm.nextFundingTime()).eq(0)
        })

        it("admin open amm will update nextFundingTime", async () => {
            // given now: October 5, 2015 12:20:00 AM
            const now = await amm.mock_getCurrentTimestamp()
            expect(now).eq(1444004400)

            // when amm open
            await amm.setOpen(true)

            // then nextFundingTime should be: October 5, 2015 1:00:00 AM
            expect(await amm.nextFundingTime()).eq(1444006800)
        })

        it("admin close amm", async () => {
            await amm.setOpen(true)
            await amm.setOpen(false)
            expect(await amm.open()).is.false
        })

        it("can't do almost everything when it's beginning", async () => {
            const error = "amm was closed"
            await expectRevert(amm.settleFunding({ from: admin }), error)
            await expectRevert(amm.swapInput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(0), false), error)
            await expectRevert(amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(0), true), error)
        })

        it("can't do almost everything when it's closed", async () => {
            await amm.setOpen(true)
            await amm.setOpen(false)
            const error = "amm was closed"
            await expectRevert(amm.settleFunding({ from: admin }), error)
            await expectRevert(amm.swapInput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(0), false), error)
            await expectRevert(amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(0), true), error)
        })

        it("force error: stranger close amm", async () => {
            await expectRevert(amm.setOpen(false, { from: alice }), "PerpFiOwnableUpgrade: caller is not the owner")
        })
    })

    describe("calculate fee/spread", () => {
        it("calcFee", async () => {
            // tx fee is 1%, spread is 1%
            await amm.setTollRatio(toDecimal(0.01))
            await amm.setSpreadRatio(toDecimal(0.01))
            const fee = await amm.calcFee(toDecimal(10))

            // [0] is tx fee, [1] is spread
            expect(fee[0]).to.eq(toFullDigit(0.1))
            expect(fee[1]).to.eq(toFullDigit(0.1))
        })

        it("set different fee ratio", async () => {
            // tx fee is 10%, spread is 5%
            await amm.setTollRatio(toDecimal(0.1))
            await amm.setSpreadRatio(toDecimal(0.05))

            const fee = await amm.calcFee(toDecimal(100))
            expect(fee[0]).to.eq(toFullDigit(10))
            expect(fee[1]).to.eq(toFullDigit(5))
        })

        it("set fee ratio to zero", async () => {
            // tx fee is 0%, spread is 5%
            await amm.setTollRatio(toDecimal(0))
            await amm.setSpreadRatio(toDecimal(0.05))

            const fee = await amm.calcFee(toDecimal(100))
            expect(fee[0]).to.eq(toFullDigit(0))
            expect(fee[1]).to.eq(toFullDigit(5))
        })

        it("calcFee with input `0` ", async () => {
            const fee = await amm.calcFee(toDecimal(0))

            expect(fee[0]).to.eq(toFullDigit(0))
            expect(fee[1]).to.eq(toFullDigit(0))
        })

        it("force error, only owner can set fee/spread ratio", async () => {
            const error = "PerpFiOwnableUpgrade: caller is not the owner"
            await expectRevert(amm.setTollRatio(toDecimal(0.2), { from: alice }), error)
            await expectRevert(amm.setSpreadRatio(toDecimal(0.2), { from: alice }), error)
        })
    })

    describe("getInputPrice/getOutputPrice", () => {
        beforeEach(async () => {
            await amm.setOpen(true)
        })
        it("getInputPrice, add to amm ", async () => {
            // amount = 100(quote asset reserved) - (100 * 1000) / (1000 + 50) = 4.7619...
            // price = 50 / 4.7619 = 10.499
            const amount = await amm.getInputPrice(Dir.ADD_TO_AMM, toDecimal(50))
            expect(amount).to.eq("4761904761904761904")
        })

        it("getInputPrice, remove from amm ", async () => {
            // amount = (100 * 1000) / (1000 - 50) - 100(quote asset reserved) = 5.2631578947368
            // price = 50 / 5.263 = 9.5
            const amount = await amm.getInputPrice(Dir.REMOVE_FROM_AMM, toDecimal(50))
            expect(amount).to.eq("5263157894736842106")
        })

        it("getOutputPrice, add to amm ", async () => {
            // amount = 1000(base asset reversed) - (100 * 1000) / (100 + 5) = 47.619047619047619048
            // price = 47.619 / 5 = 9.52
            const amount = await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(5))
            expect(amount).to.eq("47619047619047619047")
        })

        it("getOutputPrice, add to amm with dividable output", async () => {
            // a dividable number should not plus 1 at mantissa
            const amount = await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(25))
            expect(amount).to.eq(toFullDigit(200))
        })

        it("getOutputPrice, remove from amm ", async () => {
            // amount = (100 * 1000) / (100 - 5) - 1000(base asset reversed) = 52.631578947368
            // price = 52.631 / 5 = 10.52
            const amount = await amm.getOutputPrice(Dir.REMOVE_FROM_AMM, toDecimal(5))
            expect(amount).to.eq("52631578947368421053")
        })

        it("getOutputPrice, remove from amm  with dividable output", async () => {
            const amount = await amm.getOutputPrice(Dir.REMOVE_FROM_AMM, toDecimal(37.5))
            expect(amount).to.eq(toFullDigit(600))
        })
    })

    describe("swap", () => {
        beforeEach(async () => {
            await amm.setOpen(true)
        })
        it("swapInput, Long ", async () => {
            // quote asset = (1000 * 100 / (1000 + 600 ))) - 100 = - 37.5
            const receipt = await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(0), false)
            expectEvent(receipt, "SwapInput", {
                dir: Dir.ADD_TO_AMM.toString(),
                quoteAssetAmount: toFullDigit(600),
                baseAssetAmount: toFullDigit(37.5),
            })
            expectEvent(receipt, "ReserveSnapshotted", {
                quoteAssetReserve: toFullDigit(1600),
                baseAssetReserve: toFullDigit(62.5),
            })

            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1600))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(62.5))
        })

        it("swapInput, short ", async () => {
            // quote asset = (1000 * 100 / (1000 - 600)) - 100 = 150
            const receipt = await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(600), toDecimal(0), false)
            expectEvent(receipt, "SwapInput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: toFullDigit(600),
                baseAssetAmount: toFullDigit(150),
            })
            expectEvent(receipt, "ReserveSnapshotted", {
                quoteAssetReserve: toFullDigit(400),
                baseAssetReserve: toFullDigit(250),
            })

            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(400))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(250))
        })

        it("swapOutput, short", async () => {
            // base asset = 1000 - (1000 * 100 / (100 + 150)) = 600
            const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(150), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.ADD_TO_AMM.toString(),
                quoteAssetAmount: toFullDigit(600),
                baseAssetAmount: toFullDigit(150),
            })

            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(400))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(250))
        })

        it("swapOutput, long", async () => {
            // base asset = (1000 * 100 / (100 - 50)) - 1000 = 1000
            const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(50), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: toFullDigit(1000),
                baseAssetAmount: toFullDigit(50),
            })

            // baseAssetReserve = 1000 * 100 / (1000 + 800) = 55.555...
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(2000))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(50))
        })

        it("swapInput, short and then long", async () => {
            // quote asset = (1000 * 100 / (1000 - 480) - 100 = 92.30769230769...
            const response = await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(480), toDecimal(0), false)
            expectEvent(response, "SwapInput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: toFullDigit(480),
                baseAssetAmount: "92307692307692307693",
            })

            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(520))
            expect(await amm.baseAssetReserve()).to.eq("192307692307692307693")

            // quote asset = 192.307 - (1000 * 100 / (520 + 960)) = 30.555...
            const response2 = await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(960), toDecimal(0), false)
            expectEvent(response2, "SwapInput", {
                dir: Dir.ADD_TO_AMM.toString(),
                quoteAssetAmount: toFullDigit(960),
                baseAssetAmount: "124740124740124740125",
            })

            // pTokenAfter = 250 - 3000/16 = 1000 / 16
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1480))
            expect(await amm.baseAssetReserve()).to.eq("67567567567567567568")
        })

        it("swapInput, short, long and long", async () => {
            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(200), toDecimal(0), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(800))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(125))

            // swapped base asset = 13.88...8
            // base reserved = 125 - 13.88...8 = 111.11...2
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(900))
            expect(await amm.baseAssetReserve()).to.eq("111111111111111111112")

            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(200), toDecimal(0), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1100))
            expect(await amm.baseAssetReserve()).to.eq("90909090909090909092")
        })

        it("swapInput, short, long and short", async () => {
            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(200), toDecimal(25), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(800))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(125))

            // swapped base asset = 13.88...8
            // base reserved = 125 - 13.88...8 = 111.11...2
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(450), toDecimal(45), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1250))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(80))

            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(250), toDecimal(20), false)
            expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1000))
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(100))
        })

        it("swapOutput, short and not dividable", async () => {
            const amount = await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(5))
            const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(5), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.ADD_TO_AMM.toString(),
                quoteAssetAmount: amount.d,
                baseAssetAmount: toFullDigit(5),
            })
        })

        it("swapOutput, long and not dividable", async () => {
            const amount = await amm.getOutputPrice(Dir.REMOVE_FROM_AMM, toDecimal(5))
            const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(5), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: amount.d,
                baseAssetAmount: toFullDigit(5),
            })
        })

        it("swapOutput, long and then short the same size, should got different base asset amount", async () => {
            // quote asset = (1000 * 100 / (100 - 10)) - 1000 = 111.111...2
            const amount1 = await amm.getOutputPrice(Dir.REMOVE_FROM_AMM, toDecimal(10))
            await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), true)
            expect(await amm.quoteAssetReserve()).to.eq("1111111111111111111112")
            expect(await amm.baseAssetReserve()).to.eq(toFullDigit(90))

            // quote asset = 1111.111 - (111.111 * 90 / (90 + 10)) = 111.11...1
            // price will be 1 wei less after traded
            const amount2 = await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(10))
            expect(new BigNumber(amount1.d).sub(new BigNumber(amount2.d))).eq(1)
        })

        it("force error, swapInput, long but less than min base amount", async () => {
            // long 600 should get 37.5 base asset, and reserves will be 1600:62.5
            // but someone front run it, long 200 before the order 600/37.5
            await amm.mockSetReserve(toDecimal(1250), toDecimal(80))
            await expectRevert(
                amm.swapInput(Dir.ADD_TO_AMM, toDecimal(600), toDecimal(37.5), false),
                "Less than minimal base token",
            )
        })

        it("force error, swapInput, short but more than min base amount", async () => {
            // short 600 should get -150 base asset, and reserves will be 400:250
            // but someone front run it, short 200 before the order 600/-150
            await amm.mockSetReserve(toDecimal(800), toDecimal(125))
            await expectRevert(
                amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(600), toDecimal(150), false),
                "More than maximal base token",
            )
        })

        describe("swapOutput & forceSwapOutput, slippage limits of swaps", () => {
            beforeEach(async () => {
                await amm.setOpen(true)
            })

            // 1250 - 1250 * 80 / (80 + 20) = 1250 - 1000 = 250
            it("swapOutput, short", async () => {
                await amm.mockSetReserve(toDecimal(1250), toDecimal(80))
                const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(20), toDecimal(100), true)

                expectEvent(receipt, "SwapOutput", {
                    dir: Dir.ADD_TO_AMM.toString(),
                    quoteAssetAmount: toFullDigit(250),
                    baseAssetAmount: toFullDigit(20),
                })

                expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1000))
                expect(await amm.baseAssetReserve()).to.eq(toFullDigit(100))
            })

            it("swapOutput, short, (amount should pay = 250) at the limit of min quote amount = 249", async () => {
                await amm.mockSetReserve(toDecimal(1250), toDecimal(80))
                const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(20), toDecimal(249), true)

                expectEvent(receipt, "SwapOutput", {
                    dir: Dir.ADD_TO_AMM.toString(),
                    quoteAssetAmount: toFullDigit(250),
                    baseAssetAmount: toFullDigit(20),
                })

                expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1000))
                expect(await amm.baseAssetReserve()).to.eq(toFullDigit(100))
            })

            it("force error, swapOutput, short, less than min quote amount = 251", async () => {
                await amm.mockSetReserve(toDecimal(1250), toDecimal(80))
                await expectRevert(
                    amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(20), toDecimal(251), true),
                    "Less than minimal quote token",
                )
            })

            it("force error, swapOutput, short, far less than min quote amount = 400", async () => {
                await amm.mockSetReserve(toDecimal(1250), toDecimal(80))
                await expectRevert(
                    amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(20), toDecimal(400), true),
                    "Less than minimal quote token",
                )
            })

            // 800 * 125 / (125 - 25) - 800 = 1000 - 800 = 200
            it("swapOutput, long", async () => {
                await amm.mockSetReserve(toDecimal(800), toDecimal(125))

                const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(25), toDecimal(400), true)
                expectEvent(receipt, "SwapOutput", {
                    dir: Dir.REMOVE_FROM_AMM.toString(),
                    quoteAssetAmount: toFullDigit(200),
                    baseAssetAmount: toFullDigit(25),
                })

                expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1000))
                expect(await amm.baseAssetReserve()).to.eq(toFullDigit(100))
            })

            it("swapOutput, long, (amount should pay = 200) at the limit of max quote amount = 201", async () => {
                await amm.mockSetReserve(toDecimal(800), toDecimal(125))

                const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(25), toDecimal(201), true)
                expectEvent(receipt, "SwapOutput", {
                    dir: Dir.REMOVE_FROM_AMM.toString(),
                    quoteAssetAmount: toFullDigit(200),
                    baseAssetAmount: toFullDigit(25),
                })

                expect(await amm.quoteAssetReserve()).to.eq(toFullDigit(1000))
                expect(await amm.baseAssetReserve()).to.eq(toFullDigit(100))
            })

            it("force error, swapOutput, long, more than max quote amount = 199", async () => {
                // base asset =
                await amm.mockSetReserve(toDecimal(800), toDecimal(125))
                await expectRevert(
                    amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(25), toDecimal(199), true),
                    "More than maximal quote token",
                )
            })

            it("force error, swapOutput, long, far less more max quote amount = 100", async () => {
                // base asset = (1000 * 100 / (100 - 50)) - 1000 = 1000
                await amm.mockSetReserve(toDecimal(800), toDecimal(125))
                await expectRevert(
                    amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(25), toDecimal(100), true),
                    "More than maximal quote token",
                )
            })
        })
    })

    describe.only("restrict price fluctuation", () => {
        beforeEach(async () => {
            await amm.setFluctuationLimitRatio(toDecimal(0.05))
            await amm.setOpen(true)
            await moveToNextBlocks()
        })

        it("swapInput, price up and under fluctuation", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 24, reserve will be 1024 : 97.66, price is 1024 / 97.66 = 10.49
            const receipt = await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(24), toDecimal(0), false)
            expectEvent(receipt, "SwapInput")
        })

        it("swapInput, price up and over fluctuation", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 25, reserve will be 1025 : 97.56, price is 1025 / 97.56 = 10.50625
            // but _singleTxFluctuationCheck is true so it's ok to skip the check
            const receipt = await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(25), toDecimal(0), true)
            expectEvent(receipt, "SwapInput")
        })

        it("swapInput, price down and under fluctuation", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // SELL 25, reserve will be 975 : 102.56, price is 975 / 102.56 = 9.51
            const receipt = await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(25), toDecimal(0), false)
            expectEvent(receipt, "SwapInput")
        })

        it("swapOutput, price up and under fluctuation", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 2.4 base, reserve will be 1024.6 : 97.6, price is 1024.6 / 97.6 = 10.5
            const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(2.4), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput")
        })

        it("swapOutput, price down and under fluctuation", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // SELL 2.5 base, reserve will be 975.6 : 102.5, price is 975.6 / 102.5 = 9.52
            const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(2.5), toDecimal(0), true)
            expectEvent(receipt, "SwapOutput")
        })

        it("force error, swapInput, price up but reach the upper limit", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 25, reserve will be 1025 : 97.56, price is 1025 / 97.56 = 10.51
            await expectRevert(
                amm.swapInput(Dir.ADD_TO_AMM, toDecimal(25), toDecimal(0), false),
                "price is over fluctuation limit",
            )
        })

        it("force error, swapInput, price down but reach the lower limit", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // SELL 26, reserve will be 974 : 102.67, price is 974 / 102.67 = 9.49
            await expectRevert(
                amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(26), toDecimal(0), false),
                "price is over fluctuation limit",
            )
        })

        it("can swapOutput(close long) even exceeds fluctuation limit if the price impact is larger than the limit, but the rest will fail during that block", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 2.5 base, reserve will be 1025.6 : 97.5, price is 1025.6 / 97.5 = 10.52
            expectEvent(await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(2.5), toDecimal(0), true), "SwapOutput")
            await expectRevert(
                amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(0.1), toDecimal(0), true),
                "price is over fluctuation limit",
            )
        })

        it("can swapOutput(close short) even exceeds fluctuation limit if the price impact is larger than the limit, but the rest will fail during that block", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // SELL 2.7 base, reserve will be 973.7 : 102.7, price is 973.7 / 102.7 = 9.48
            expectEvent(await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(2.7), toDecimal(0), true), "SwapOutput")
            await expectRevert(
                amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(0.1), toDecimal(0), true),
                "price is over fluctuation limit",
            )
        })

        it("force error, swap many times to over the fluctuation in a single block", async () => {
            // fluctuation is 5%, price is between 9.5 ~ 10.5
            // BUY 10+10+10, reserve will be 1030 : 97.09, price is 1030 / 97.09 = 10.61
            await moveToNextBlocks(1)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await expectRevert(
                amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false),
                "price is over fluctuation limit",
            )
        })

        it("force error, compare price fluctuation with previous blocks in a block", async () => {
            // BUY 10, reserve will be 1010 : 99.01, price is 1010 / 99.01 = 10.2
            // fluctuation is 5%, price is between 9.69 ~ 10.71
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await moveToNextBlocks(1)

            // SELL 26, reserve will be 984 : 101.63, price is 984 / 101.63 = 9.68
            const error = "price is over fluctuation limit"
            await expectRevert(amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(26), toDecimal(0), false), error)

            // BUY 30, reserve will be 1040 : 96.15, price is 1040 / 96.15 = 10.82
            await expectRevert(amm.swapInput(Dir.ADD_TO_AMM, toDecimal(30), toDecimal(0), false), error)
            // should revert as well if BUY 30 separately
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await expectRevert(amm.swapInput(Dir.ADD_TO_AMM, toDecimal(20), toDecimal(0), false), error)
        })

        it("force error, the value of fluctuation is the same even when no any tradings for blocks", async () => {
            // BUY 10, reserve will be 1010 : 99.01, price is 1010 / 99.01 = 10.2
            // fluctuation is 5%, price is between 9.69 ~ 10.71
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await moveToNextBlocks(3)

            // BUY 25, reserve will be 1035 : 96.62, price is 1035 / 96.62 = 10.712
            await expectRevert(
                amm.swapInput(Dir.ADD_TO_AMM, toDecimal(25), toDecimal(0), false),
                "price is over fluctuation limit",
            )
        })
    })

    describe("swapInput and swapOutput", () => {
        beforeEach(async () => {
            await amm.setOpen(true)
        })
        it("use getOutputPrice to query price and use it to swapInput(long)", async () => {
            // when trader ask what's the requiredQuoteAsset if trader want to remove 10 baseAsset from amm
            const requiredQuoteAsset = await amm.getOutputPrice(Dir.REMOVE_FROM_AMM, toDecimal(10))

            // when trader add requiredQuoteAsset to amm
            const receipt = await amm.swapInput(Dir.ADD_TO_AMM, requiredQuoteAsset, toDecimal(0), false)

            // then event.baseAssetAmount should be equal to 10

            expectEvent(receipt, "SwapInput", {
                dir: Dir.ADD_TO_AMM.toString(),
                quoteAssetAmount: requiredQuoteAsset.d,
                baseAssetAmount: toFullDigit(10),
            })
        })

        it("use getOutputPrice to query price and use it to swapInput(short)", async () => {
            // when trader ask what's the requiredQuoteAsset if trader want to add 10 baseAsset from amm
            const requiredQuoteAsset = await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(10))

            // when trader remove requiredQuoteAsset to amm
            const receipt = await amm.swapInput(Dir.REMOVE_FROM_AMM, requiredQuoteAsset, toDecimal(0), false)

            // then event.baseAssetAmount should be equal to 10
            expectEvent(receipt, "SwapInput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: requiredQuoteAsset.d,
                baseAssetAmount: toFullDigit(10),
            })
        })

        it("use getInputPrice(long) to swapOutput", async () => {
            // when trader ask what's the baseAsset she will receive if trader want to add 10 quoteAsset to amm
            const receivedBaseAsset = await amm.getInputPrice(Dir.ADD_TO_AMM, toDecimal(10))

            // when trader trade quoteAsset for receivedBaseAsset (amount as above)
            const receipt = await amm.swapOutput(Dir.REMOVE_FROM_AMM, receivedBaseAsset, toDecimal(0), true)

            // then event.quoteAsset should be equal to 10
            // if swapOutput is adjusted, the price should be higher (>= 10)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.REMOVE_FROM_AMM.toString(),
                quoteAssetAmount: toFullDigit(10),
                baseAssetAmount: receivedBaseAsset.d,
            })
        })

        it("use getInputPrice(short) to swapOutput", async () => {
            // when trader ask what's the baseAsset she will receive if trader want to remove 10 quoteAsset to amm
            const receivedBaseAsset = await amm.getInputPrice(Dir.REMOVE_FROM_AMM, toDecimal(10))

            // when trader trade quoteAsset for receivedBaseAsset (amount as above)
            const receipt = await amm.swapOutput(Dir.ADD_TO_AMM, receivedBaseAsset, toDecimal(0), true)

            // then event.quoteAsset should be equal to 10
            // if swapOutput is adjusted, the price should be higher (>= 10)
            expectEvent(receipt, "SwapOutput", {
                dir: Dir.ADD_TO_AMM.toString().toString(),
                quoteAssetAmount: "10000000000000000009",
                baseAssetAmount: receivedBaseAsset.d,
            })
        })

        it("swapInput twice, short and long", async () => {
            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)

            // then the reserve shouldn't be less than the original reserve
            expect(await amm.baseAssetReserve()).eq("100000000000000000001")
            expect(await amm.quoteAssetReserve()).eq(toFullDigit(1000))
        })

        it("swapInput twice, long and short", async () => {
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), false)
            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

            // then the reserve shouldn't be less than the original reserve
            expect(await amm.baseAssetReserve()).eq("100000000000000000001")
            expect(await amm.quoteAssetReserve()).eq(toFullDigit(1000))
        })

        it("swapOutput twice, short and long", async () => {
            await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), true)
            await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), true)

            // then the reserve shouldn't be less than the original reserve
            expect(await amm.baseAssetReserve()).eq(toFullDigit(100))
            expect(await amm.quoteAssetReserve()).eq("1000000000000000000001")
        })

        it("swapOutput twice, long and short", async () => {
            await amm.swapOutput(Dir.ADD_TO_AMM, toDecimal(10), toDecimal(0), true)
            await amm.swapOutput(Dir.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), true)
            // then the reserve shouldn't be less than the original reserve
            expect(await amm.baseAssetReserve()).eq(toFullDigit(100))
            expect(await amm.quoteAssetReserve()).eq("1000000000000000000001")
        })
    })

    describe("twap price", () => {
        beforeEach(async () => {
            await amm.setOpen(true)
            // Mainnet average block time is 13.6 secs, 14 is easier to calc
            // create 30 snapshot first, the average price will be 9.04
            await forward(14)
            for (let i = 0; i < 30; i++) {
                // console.log((await amm.getOutputPrice(Dir.ADD_TO_AMM, toDecimal(10))).d.toString())
                if (i % 3 == 0) {
                    await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                } else {
                    await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(50), toDecimal(0), false)
                }

                await forward(14)
            }
        })

        describe("Future twap price", () => {
            // price will be only
            // 8.12 (after REMOVE_FROM_AMM 100)
            // 9.03 (after ADD_TO_AMM 50),  and
            // 10 (after the second ADD_TO_AMM 50)
            // average is 9.04

            it("get twap price", async () => {
                // 210 / 14 = 15 snapshots,
                // average is 9.04 =
                // (8.12 x 5 snapshots x 14 secs + 9.03 x 5 x 14 + 10 x 5 x 14) / 210
                const twap = await amm.getTwapPrice(210)
                expect(twap).to.eq("9041666666666666665")
            })

            it("the timestamp of latest snapshot is now, the latest snapshot wont have any effect ", async () => {
                // price is 8.12 but time weighted is zero
                await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                // 210 / 14 = 15 snapshots,
                // average is 9.04 =
                // (8.12 x 5 snapshots x 14 secs + 9.03 x 5 x 14 + 10 x 5 x 14) / 210
                const twap = await amm.getTwapPrice(210)
                expect(twap).to.eq("9041666666666666665")
            })

            it("asking interval more than snapshots have", async () => {
                // only have 31 snapshots.
                // average is 9.07 =
                // (8.12 x 10 snapshots x 14 secs + 9.03 x 10 x 14 + 10 x 11 x 14) / (31 x 14))
                expect(await amm.getTwapPrice(900)).to.eq("9072580645161290321")
            })

            it("asking interval less than latest snapshot, return latest price directly", async () => {
                // price is 8.1
                await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                await forward(300)
                expect(await amm.getTwapPrice(210)).to.eq("8099999999999999998")
            })

            it("price with interval 0 should be the same as spot price", async () => {
                expect(await amm.getTwapPrice(0)).to.eq(await amm.getSpotPrice())
            })
        })

        describe("Input asset twap price", () => {
            describe("input twap", () => {
                // price will be only
                // 1221001221001221002 (after REMOVE_FROM_AMM 100)
                // 1096491228070175439 (after ADD_TO_AMM 50),  and
                // 990099009900990099 (after the second ADD_TO_AMM 50)

                it("get twap price", async () => {
                    // total snapshots will be 65, 65 x 14 = 910 secs
                    // getInputTwap/getOutputPrice get 15 mins average
                    for (let i = 0; i < 34; i++) {
                        if (i % 3 == 0) {
                            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                        } else {
                            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(50), toDecimal(0), false)
                        }
                        await forward(14)
                    }

                    //
                    // average is 1103873668968336329 =
                    // (990099009900990099 x 21 snapshots x 14 secs + 1096491228070175439 x 21 x 14 + 1221001221001221002 x 22 x 14 +
                    //  990099009900990099 x 1 snapshots x 4 secs) / 900
                    const twap = await amm.getInputTwap(Dir.ADD_TO_AMM, toDecimal(10))
                    expect(twap).to.eq("1103873668968336329")
                })

                it("the timestamp of latest snapshot is now, the latest snapshot wont have any effect ", async () => {
                    // total snapshots will be 65, 65 x 14 = 910 secs
                    // getInputTwap/getOutputPrice get 15 mins average
                    for (let i = 0; i < 34; i++) {
                        if (i % 3 == 0) {
                            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                        } else {
                            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(50), toDecimal(0), false)
                        }
                        await forward(14)
                    }

                    // price is 8.12 but time weighted is zero
                    await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)

                    const twap = await amm.getInputTwap(Dir.ADD_TO_AMM, toDecimal(10))
                    expect(twap).to.eq("1103873668968336329")
                })

                it("accumulative time of snapshots is less than 15 mins ", async () => {
                    // average is 1098903664504027596 =
                    // (990099009900990099 x 11 snapshots x 14 secs + 1096491228070175439 x 10 x 14 + 1221001221001221002 x 10 x 14) / (31 x 14)
                    const twap = await amm.getInputTwap(Dir.ADD_TO_AMM, toDecimal(10))
                    expect(twap).to.eq("1098903664504027596")
                })

                it("input asset is 0, should return 0", async () => {
                    const twap = await amm.getInputTwap(Dir.ADD_TO_AMM, toDecimal(0))
                    expect(twap).eq("0")
                })
            })

            describe("output twap", () => {
                // Output price will be only
                // 74311926605504587146
                // 82420091324200913231
                // 90909090909090909079
                it("get twap output price", async () => {
                    // total snapshots will be 65, 65 x 14 = 910 secs
                    // getInputTwap/getOutputPrice get 15 mins average
                    for (let i = 0; i < 34; i++) {
                        if (i % 3 == 0) {
                            await amm.swapInput(Dir.REMOVE_FROM_AMM, toDecimal(100), toDecimal(0), false)
                        } else {
                            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(50), toDecimal(0), false)
                        }

                        await forward(14)
                    }

                    //
                    // average is 82456099260799524707 =
                    // (90909090909090909079 x 21 snapshots x 14 secs + 82420091324200913231 x 21 x 14 + 74311926605504587146 x 22 x 14 +
                    //  90909090909090909079 x 1 snapshots x 4 secs) / 900
                    const twap = await amm.getOutputTwap(Dir.ADD_TO_AMM, toDecimal(10))
                    expect(twap).to.eq("82456099260799524707")
                })

                it("accumulative time of snapshots is less than 15 mins ", async () => {
                    // average is 82816779977324354961 =
                    // (90909090909090909079 x 11 snapshots x 14 secs + 82420091324200913231 x 10 x 14 + 74311926605504587146 x 10 x 14) / (31 x 14)
                    const twap = await amm.getOutputTwap(Dir.ADD_TO_AMM, toDecimal(10))
                    expect(twap).to.eq("82816779977324354961")
                })

                it("input asset is 0, should return 0", async () => {
                    const twap = await amm.getOutputTwap(Dir.ADD_TO_AMM, toDecimal(0))
                    expect(twap).eq("0")
                })
            })
        })
    })

    describe("AmmCalculator", () => {
        beforeEach(async () => {
            await amm.setOpen(true)
        })
        describe("getInputPriceWithReserves", () => {
            it("should return 37.5B when ask for 600Q input at B100/Q1000 reserve and add to Amm", async () => {
                const amount = await amm.getInputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(600),
                    toDecimal(1000),
                    toDecimal(100),
                )

                expect(amount).eq(toFullDigit(37.5))
            })

            it("should return 150B  when ask for 600Q input at B100/Q1000 reserve and remove from Amm", async () => {
                const amount = await amm.getInputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(600),
                    toDecimal(1000),
                    toDecimal(100),
                )

                expect(amount).eq(toFullDigit(150))
            })

            it("should get expected (amount - 1) when the base asset amount is not dividable and add to Amm", async () => {
                const amount = await amm.getInputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(200),
                    toDecimal(1000),
                    toDecimal(100),
                )

                // 1000 * 100 / 1200 = 83.33
                // 100 - 83.33 = 16.66..7 - 1
                expect(amount).eq("16666666666666666666")
            })

            it("should get expected amount when the base asset amount is not dividable but remove from Amm", async () => {
                const amount = await amm.getInputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(100),
                    toDecimal(1000),
                    toDecimal(100),
                )

                // trader will get 1 wei more negative position size
                expect(amount).eq("11111111111111111112")
            })

            it("reach trading limit", async () => {
                await expect(
                    amm.getInputPriceWithReservesPublic(
                        Dir.REMOVE_FROM_AMM,
                        toDecimal(900),
                        toDecimal(1000),
                        toDecimal(100),
                    ),
                ).to.not.rejectedWith("over trading limit")
            })

            it("force error, value of quote asset is 0", async () => {
                await expectRevert(
                    amm.getInputPriceWithReservesPublic(
                        Dir.REMOVE_FROM_AMM,
                        toDecimal(900),
                        toDecimal(900),
                        toDecimal(900),
                    ),
                    "quote asset after is 0",
                )
            })
        })

        describe("getOutputPriceWithReserves", () => {
            it("should need 375Q for 60B output at B100/Q1000 reserve when add to Amm", async () => {
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(60),
                    toDecimal(1000),
                    toDecimal(100),
                )

                expect(amount).eq(toFullDigit(375).toString())
            })
            it("should need 250Q for 20B output at B100/Q1000 reserve when remove from Amm", async () => {
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(20),
                    toDecimal(1000),
                    toDecimal(100),
                )

                expect(amount).eq(toFullDigit(250).toString())
            })

            it("should get expected (amount + 1) when the quote asset amount is not dividable and remove Amm", async () => {
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(25),
                    toDecimal(1000),
                    toDecimal(100),
                )

                // 1000 * 100 / 75 = 1333.33
                // 1333.33 - 1000 = 33.33...3 + 1
                expect(amount).eq("333333333333333333334")
            })

            it("should get expected amount when the base asset amount is not dividable but add to Amm", async () => {
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(20),
                    toDecimal(1000),
                    toDecimal(100),
                )

                // trader will get 1 wei less quoteAsset
                expect(amount).eq("166666666666666666666")
            })

            it("force error, value of base asset is 0", async () => {
                await expectRevert(
                    amm.getOutputPriceWithReservesPublic(
                        Dir.REMOVE_FROM_AMM,
                        toDecimal(900),
                        toDecimal(900),
                        toDecimal(900),
                    ),
                    "base asset after is 0",
                )
            })
        })

        describe("the result of x's getOutPrice of getInputPrice should be equals to x", () => {
            it("without fee, getOutputPrice(getInputPrice(x).amount) == x (quote settlement)", async () => {
                const baseAssetAmount = await amm.getInputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(250),
                    toDecimal(1000),
                    toDecimal(100),
                )
                const quoteAssetAmmPrice = await amm.getOutputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    { d: baseAssetAmount.toString() },
                    toDecimal(1250),
                    toDecimal(80),
                )

                expect(quoteAssetAmmPrice).eq(toFullDigit(250))
            })

            it("without fee, getOutputPrice(getInputPrice(x).amount) == x (base settlement)", async () => {
                const baseAssetAmount = await amm.getInputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(200),
                    toDecimal(1000),
                    toDecimal(100),
                )
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    { d: baseAssetAmount.toString() },
                    toDecimal(800),
                    toDecimal(125),
                )

                expect(amount).eq(toFullDigit(200))
            })

            it("without fee, getInputPrice(getOutputPrice(x).amount) == x (quote settlement)", async () => {
                const quoteAssetAmmPrice = await amm.getOutputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    toDecimal(60),
                    toDecimal(1000),
                    toDecimal(100),
                )
                const baseAssetAmount = await amm.getInputPriceWithReservesPublic(
                    Dir.ADD_TO_AMM,
                    { d: quoteAssetAmmPrice.toString() },
                    toDecimal(625),
                    toDecimal(160),
                )

                expect(baseAssetAmount).eq(toFullDigit(60))
            })

            it("without fee, getInputPrice(getOutputPrice(x).amount) == x (base settlement)", async () => {
                const amount = await amm.getOutputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    toDecimal(60),
                    toDecimal(1000),
                    toDecimal(100),
                )
                const baseAssetAmount = await amm.getInputPriceWithReservesPublic(
                    Dir.REMOVE_FROM_AMM,
                    { d: amount.toString() },
                    toDecimal(2500),
                    toDecimal(40),
                )

                expect(baseAssetAmount).eq(toFullDigit(60))
            })
        })

        describe("AMM will always get 1 wei more reserve than trader when the result is not dividable", () => {
            it("swapInput, add to amm", async () => {
                // add 200 quote, amm: 83.33...4:1200. trader: 12.66
                expect(
                    await amm.getInputPriceWithReservesPublic(
                        Dir.ADD_TO_AMM,
                        toDecimal(200),
                        toDecimal(1000),
                        toDecimal(100),
                    ),
                ).eq("16666666666666666666")
            })

            it("swapInput, remove from amm", async () => {
                // remove 100 quote, amm: 111.111...1 + 1 wei:900. trader: -11.11...1 - 1wei
                expect(
                    await amm.getInputPriceWithReservesPublic(
                        Dir.REMOVE_FROM_AMM,
                        toDecimal(100),
                        toDecimal(1000),
                        toDecimal(100),
                    ),
                ).eq("11111111111111111112")
            })

            it("swapOutput, add to amm", async () => {
                // add 20 base, amm: 120:83.33...+ 1 wei. trader: 166.66..6
                expect(
                    await amm.getOutputPriceWithReservesPublic(
                        Dir.ADD_TO_AMM,
                        toDecimal(20),
                        toDecimal(1000),
                        toDecimal(100),
                    ),
                ).eq("166666666666666666666")
            })

            it("swapOutput, remove from amm", async () => {
                // remove 10 base, amm: 90:1111.11...1 + 1 wei. trader: -111.11 - 1 wei
                expect(
                    await amm.getOutputPriceWithReservesPublic(
                        Dir.REMOVE_FROM_AMM,
                        toDecimal(10),
                        toDecimal(1000),
                        toDecimal(100),
                    ),
                ).eq("111111111111111111112")
            })
        })

        describe("settleFunding", () => {
            it("settleFunding delay before fundingBufferPeriod ends", async () => {
                const originalNextFundingTime = await amm.nextFundingTime()
                const settleFundingTimestamp = originalNextFundingTime.add(fundingBufferPeriod).subn(1)
                await amm.mock_setBlockTimestamp(settleFundingTimestamp)
                await amm.settleFunding()
                expect(await amm.nextFundingTime()).eq(originalNextFundingTime.add(fundingPeriod))
            })

            it("settleFunding delay after fundingBufferPeriod ends & before nextFundingTime", async () => {
                const originalNextFundingTime = await amm.nextFundingTime()
                const settleFundingTimestamp = originalNextFundingTime.add(fundingBufferPeriod).addn(1)
                await amm.mock_setBlockTimestamp(settleFundingTimestamp)
                await amm.settleFunding()
                expect(await amm.nextFundingTime()).eq(new BN(settleFundingTimestamp).add(fundingBufferPeriod))
            })

            it("force error, caller is not counterParty/clearingHouse", async () => {
                const addresses = await web3.eth.getAccounts()
                await expectRevert(amm.settleFunding({ from: addresses[1] }), "caller is not counterParty")
            })

            it("can't settleFunding multiple times at once even settleFunding delay", async () => {
                const startAt = await amm.mock_getCurrentTimestamp()
                const delayDuration = fundingPeriod.muln(10)
                const settleFundingTimestamp = new BN(startAt).add(delayDuration)
                await amm.mock_setBlockTimestamp(settleFundingTimestamp)
                await amm.settleFunding()
                await expectRevert(amm.settleFunding(), "settle funding too early")
            })
        })
    })
})
