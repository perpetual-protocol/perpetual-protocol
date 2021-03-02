import { web3 } from "hardhat"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { suite, test } from "@testdeck/mocha"
import { default as BigNumber } from "bn.js"
import { expect, use } from "chai"
import { AmmFakeInstance, L2PriceFeedMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployAmm, deployL2MockPriceFeed } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

enum Side {
    ADD_TO_AMM = 0,
    REMOVE_FROM_AMM = 1,
}
const ZERO = new BigNumber(0)
const DEFAULT_PRICE = new BigNumber(10)

@suite
class AmmSpec {
    amm!: AmmFakeInstance
    priceFeed!: L2PriceFeedMockInstance
    admin!: string
    otherA!: string
    fakeTokenAddr!: string
    fundingPeriod!: number
    fundingBufferPeriod!: number

    async before(): Promise<void> {
        const accounts = await web3.eth.getAccounts()
        this.admin = accounts[0]
        this.otherA = accounts[1]

        this.priceFeed = await deployL2MockPriceFeed(DEFAULT_PRICE)
        await this.deployAMM()
        this.fundingPeriod = (await this.amm.fundingPeriod()).toNumber()
        this.fundingBufferPeriod = (await this.amm.fundingBufferPeriod()).toNumber()
    }

    private async deployAMM(tollRatio = ZERO, spreadRatio = ZERO): Promise<void> {
        this.fakeTokenAddr = this.otherA
        this.amm = await deployAmm({
            deployer: this.admin,
            quoteAssetTokenAddr: this.fakeTokenAddr,
            priceFeedAddr: this.priceFeed.address,
            fluctuation: toFullDigit(0),
        })
        await this.amm.setCounterParty(this.admin)
        await this.amm.setOpen(true)
    }

    private async moveToNextBlocks(number: number): Promise<void> {
        const blockNumber = new BigNumber(await this.amm.mock_getCurrentBlockNumber())
        await this.amm.mock_setBlockNumber(blockNumber.addn(number))
    }

    private async forward(seconds: number): Promise<void> {
        const timestamp = new BigNumber(await this.amm.mock_getCurrentTimestamp())
        await this.amm.mock_setBlockTimestamp(timestamp.addn(seconds))
        const movedBlocks = seconds / 15 < 1 ? 1 : seconds / 15
        await this.moveToNextBlocks(movedBlocks)
    }

    //
    // TWAP cases
    //
    @test
    async getTwapLong(): Promise<void> {
        await this.deployAMM()
        const { amm } = this
        // ReserveSnapshot0 {
        //     quoteAssetReserve = 1000
        //     baseAssetReserve = 100
        //     timestamp = now
        // }

        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)
        // ReserveSnapshot1 {
        //     quoteAssetReserve = 1100
        //     baseAssetReserve = 90.9090...
        //     timestamp = now + 15
        // }

        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)
        // ReserveSnapshot2 {
        //     quoteAssetReserve = 1200
        //     baseAssetReserve = 83.333
        //     timestamp = now + 30
        // }

        // TWAP:
        //  cumulativeQuoteAsset =
        //      _getInputPrice(ADD_TO_AMM, 10, 1000, 100) * 15 +
        //      _getInputPrice(ADD_TO_AMM, 10, 1100, 90.909) * 15 +
        //      _getInputPrice(ADD_TO_AMM, 10, 1200, 83.333) * 15
        //  averageQuoteAsset = cumulativeQuoteAsset / (15+15+15)
        //  TWAP = 10 / averageQuoteAsset
        await this.forward(15)
        const twap = await amm.getInputTwap(Side.ADD_TO_AMM, toDecimal(10))
        expect(twap).eq("832601687687196237")
    }

    @test
    async getTwapLongWithInterval(): Promise<void> {
        await this.deployAMM()
        const { amm } = this
        // ReserveSnapshot0 {
        //     quoteAssetReserve = 1000
        //     baseAssetReserve = 100
        //     timestamp = now
        // }

        // made a tx in the 1st block
        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)
        // ReserveSnapshot1 {
        //     quoteAssetReserve = 1100
        //     baseAssetReserve = 90.9090...
        //     timestamp = now + 15
        // }

        // several blocks later
        await this.forward(30)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)
        // ReserveSnapshot2 {
        //     quoteAssetReserve = 1200
        //     baseAssetReserve = 83.333
        //     timestamp = now + 45
        // }

        // TWAP:
        //  cumulativeQuoteAsset =
        //      _getInputPrice(ADD_TO_AMM, 10, 1000, 100) * 15 +
        //      _getInputPrice(ADD_TO_AMM, 10, 1100, 90.909) * 30 +
        //      _getInputPrice(ADD_TO_AMM, 10, 1200, 83.333) * 60
        //  averageQuoteAsset = cumulativeQuoteAsset / (15+30+60)
        //  TWAP = 10 / averageQuoteAsset
        await this.forward(60)
        const twap = await amm.getInputTwap(Side.ADD_TO_AMM, toDecimal(10))
        expect(twap).eq("768988797791678079")
    }

    @test
    async getInputTwapLongWithNoSwap(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        await this.forward(45)
        const twap = await amm.getInputTwap(Side.ADD_TO_AMM, toDecimal(10))
        expect(twap).eq("990099009900990099")
    }

    @test
    async getInputTwapLongWithLongInterval(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        // made a tx in the 1st block
        await this.forward(915)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)

        // several blocks later
        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)

        await this.forward(15)
        const twap = await amm.getInputTwap(Side.ADD_TO_AMM, toDecimal(10))
        expect(twap).eq("982224143790300405")
    }

    @test
    async getTwapShort(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        // made a tx in the 1st block
        // await changeBlockTime(15)

        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        // several blocks later
        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        await this.forward(15)
        const twap = await amm.getInputTwap(Side.REMOVE_FROM_AMM, toDecimal(10))
        expect(twap).eq("1030927835051546392")
    }

    @test
    async getInputTwapShortWithInterval(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        // made a tx in the 1st block
        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        // several blocks later
        await this.forward(30)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        await this.forward(60)
        const twap = await amm.getInputTwap(Side.REMOVE_FROM_AMM, toDecimal(10))
        expect(twap).eq("1039914336779474587")
    }

    @test
    async getInputTwapShortWithNoSwap(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        const newTimestamp = new BigNumber(await amm.mock_getCurrentTimestamp()).addn(45)
        await amm.mock_setBlockTimestamp(newTimestamp)
        const twap = await amm.getInputTwap(Side.REMOVE_FROM_AMM, toDecimal(10))
        expect(twap).eq("1010101010101010102")
    }

    @test
    async getInputTwapShortWithLongInterval(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        // made a tx in the 1st block

        await this.forward(915)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        // several blocks later

        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        await this.forward(15)
        const twap = await amm.getInputTwap(Side.REMOVE_FROM_AMM, toDecimal(10))
        expect(twap).eq("1011142351348536916")
    }

    @test
    async getOutputTwapLong(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)

        await this.forward(15)
        await amm.swapInput(Side.ADD_TO_AMM, toDecimal(100), toDecimal(0), false)

        await this.forward(15)
        const twap = await amm.getOutputTwap(Side.ADD_TO_AMM, toDecimal(10))
        expect(twap).eq("109496509496509496508")
    }

    @test
    async getOutputTwapShort(): Promise<void> {
        await this.deployAMM()
        const { amm } = this

        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        await this.forward(15)
        await amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(10), toDecimal(0), false)

        await this.forward(15)
        const twap = await amm.getOutputTwap(Side.REMOVE_FROM_AMM, toDecimal(10))
        expect(twap).eq("108788248838328695398")
    }

    //
    // Other cases
    //

    @test
    async getFinalPriceBeforeClose(): Promise<void> {
        const { amm } = this
        const ret = await amm.getUnderlyingPrice()
        expect(ret).to.eq(DEFAULT_PRICE)
    }

    @test
    async settleFunding(): Promise<void> {
        const { amm } = this
        // given a zero initial fundingRate
        const fundingRate = await amm.fundingRate()
        expect(fundingRate).to.eq(0)

        // no one can settleFunding until nextFundingTime
        await expectRevert(amm.settleFunding(), "settle funding too early")

        // submit rpc call to modify block.timestamp
        const newTimestamp = new BigNumber(await amm.mock_getCurrentTimestamp()).addn(this.fundingPeriod + 1)
        await amm.mock_setBlockTimestamp(newTimestamp)
        // await changeBlockTime(fundingPeriod + 1)

        // then fundingRate and nextFundingTime is updated
        // premiumFraction = premium * fundingPeriod / 24h = (10 - 10.3) / 3 = -0.1
        // fundingRate = premiumFraction / underlyingPrice = -0.1 / 10.3 ~= -0.97%
        await this.priceFeed.setTwapPrice(toFullDigit(103).divn(10))
        const response = await amm.settleFunding()

        expectEvent(response, "FundingRateUpdated", { rate: "-9708737864077669" })
        expect(await amm.fundingRate()).eq("-9708737864077669")
    }

    //
    // Force Error Cases
    //

    @test
    async fePlaceOrderByNonOwner(): Promise<void> {
        await expectRevert(
            this.amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(200), toDecimal(0), false, {
                from: this.otherA,
            }),
            "caller is not counterParty",
        )
    }

    @test
    async feTradeOverAmountSwapInput(): Promise<void> {
        // trade limit rate is 0.9, means can not trade over 1000 * 0.9 amount
        await expectRevert(
            this.amm.swapInput(Side.REMOVE_FROM_AMM, toDecimal(901), toDecimal(0), false),
            "over trading limit",
        )
    }

    @test
    async feTradeOverAmountSwapOutput(): Promise<void> {
        // trade limit rate is 0.9, means can not trade over 1000 * 0.9 amount
        await expectRevert(
            this.amm.swapOutput(Side.REMOVE_FROM_AMM, toDecimal(91), toDecimal(0), false),
            "over trading limit",
        )
    }

    @test
    async feFundingPeriodIsZero(): Promise<void> {
        const fakeTokenAddr = this.otherA
        await expectRevert(
            deployAmm({
                deployer: this.admin,
                quoteAssetTokenAddr: fakeTokenAddr,
                priceFeedAddr: this.priceFeed.address,
                fundingPeriod: new BigNumber(0),
                fluctuation: toFullDigit(0),
            }),
            "invalid input",
        )
    }
}
