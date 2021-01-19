import { web3 } from "@nomiclabs/buidler"
import { expectRevert } from "@openzeppelin/test-helpers"
import { default as BigNumber } from "bn.js"
import { use } from "chai"
import { AmmFakeInstance, ERC20FakeInstance, L2PriceFeedMockInstance } from "../../types/truffle"
import { assertionHelper } from "../helper/assertion-plugin"
import { deployAmm, deployErc20Fake, deployL2MockPriceFeed, Dir } from "../helper/contract"
import { toDecimal, toFullDigit } from "../helper/number"

use(assertionHelper)

describe("Amm migrate liquidity spec", () => {
    const ETH_PRICE = 100

    let amm: AmmFakeInstance
    let priceFeed: L2PriceFeedMockInstance
    let quoteToken: ERC20FakeInstance
    let admin: string
    let alice: string

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
            baseAssetReserve: toFullDigit(100),
            quoteAssetReserve: toFullDigit(1000),
        })
        await amm.setCounterParty(admin)
        await amm.setOpen(true)
    })

    it("increase liquidity", async () => {
        // move price to 80:1250
        await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
        // when amm.migrateLiquidity(2, toDecimal(0)) from 80:1250 to 160:2500
        await amm.migrateLiquidity(toDecimal(2), toDecimal(0))

        const reserve = await amm.getReserve()
        expect(reserve[0]).eq(toFullDigit(2500))
        expect(reserve[1]).eq(toFullDigit(160))

        // 20 * 88.89% = 17.778
        // const getBaseAssetDeltaThisFundingPeriod = await amm.getBaseAssetDeltaThisFundingPeriod()
        // expect(getBaseAssetDeltaThisFundingPeriod).eq("-17777777777777777778")

        const liquidityChangedSnapshot = await amm.getLiquidityChangedSnapshots(1)
        expect(liquidityChangedSnapshot.quoteAssetReserve).eq(toFullDigit(2500))
        expect(liquidityChangedSnapshot.baseAssetReserve).eq(toFullDigit(160))
        expect(liquidityChangedSnapshot.cumulativeNotional).eq(toFullDigit(250))
    })

    it("decrease liquidity", async () => {
        await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
        // when amm.migrateLiquidity(0.5, toDecimal(0)) from 80:1250 to 40:625
        await amm.migrateLiquidity(toDecimal(0.5), toDecimal(0))

        const reserve = await amm.getReserve()
        expect(reserve[0]).eq(toFullDigit(625))
        expect(reserve[1]).eq(toFullDigit(40))

        // 20 * 133.33% = 26.66
        // const getBaseAssetDeltaThisFundingPeriod = await amm.getBaseAssetDeltaThisFundingPeriod()
        // expect(getBaseAssetDeltaThisFundingPeriod).eq("-26666666666666666667")

        const liquidityChangedSnapshot = await amm.getLiquidityChangedSnapshots(1)
        expect(liquidityChangedSnapshot.quoteAssetReserve).eq(toFullDigit(625))
        expect(liquidityChangedSnapshot.baseAssetReserve).eq(toFullDigit(40))
        expect(liquidityChangedSnapshot.cumulativeNotional).eq(toFullDigit(250))
    })

    it("will fail if the liquidity is the same", async () => {
        await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
        // when amm.migrateLiquidity(1, toDecimal(0)) from 80:1250 to the same reserve
        // 133.33%
        await expectRevert(amm.migrateLiquidity(toDecimal(1), toDecimal(0)), "multiplier can't be 1")
    })

    describe("fluctuation limit test", () => {
        it("open a valid position while increasing liquidity", async () => {
            // originally 100: 1000, price = 10
            // move to 80: 1250, price = 15.625
            await forward(15)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
            await amm.migrateLiquidity(toDecimal(2), toDecimal(0.563))

            const reserve = await amm.getReserve()
            expect(reserve[0]).eq(toFullDigit(2500))
            expect(reserve[1]).eq(toFullDigit(160))
        })

        it("force error, open an invalid position (over fluctuation) while increasing liquidity", async () => {
            await forward(15)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))

            await expectRevert(amm.migrateLiquidity(toDecimal(2), toDecimal(0.562)), "price is over fluctuation limit")
        })

        it("open a valid position while decreasing liquidity", async () => {
            await forward(15)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
            await amm.migrateLiquidity(toDecimal(0.5), toDecimal(0.563))

            const reserve = await amm.getReserve()
            expect(reserve[0]).eq(toFullDigit(625))
            expect(reserve[1]).eq(toFullDigit(40))
        })

        it("force error, open an invalid position (over fluctuation) while decreasing liquidity", async () => {
            await forward(15)
            await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))

            await expectRevert(
                amm.migrateLiquidity(toDecimal(0.5), toDecimal(0.562)),
                "price is over fluctuation limit",
            )
        })
    })
})
