import { web3 } from "@nomiclabs/buidler"
import { expectEvent, expectRevert } from "@openzeppelin/test-helpers"
import { use } from "chai"
import { AmmFakeInstance, ERC20FakeInstance, L2PriceFeedMockInstance } from "../../types"
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

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]
        alice = addresses[1]

        priceFeed = await deployL2MockPriceFeed(toFullDigit(ETH_PRICE), admin, admin)
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

        // move price to 80:1250
        await amm.swapInput(Dir.ADD_TO_AMM, toDecimal(250), toDecimal(0))
    })

    it("increase liquidity", async () => {
        // when amm.migrateLiquidity(2) from 80:1250 to 160:2500
        // 88.89%
        expectEvent(await amm.migrateLiquidity(toDecimal(2)), "LiquidityChanged", {
            positionMultiplier: "888888888888888888",
        })

        const reserve = await amm.getReserve()
        expect(reserve[0]).eq(toFullDigit(2500))
        expect(reserve[1]).eq(toFullDigit(160))

        // 20 * 88.89% = 17.778
        const getBaseAssetDeltaThisFundingPeriod = await amm.getBaseAssetDeltaThisFundingPeriod()
        expect(getBaseAssetDeltaThisFundingPeriod).eq("-17777777777777777760")

        const getCumulativePositionMultiplier = await amm.getCumulativePositionMultiplier()
        expect(getCumulativePositionMultiplier).eq("888888888888888888")

        const liquidityChangedSnapshot = await amm.liquidityChangedSnapshot()
        expect(liquidityChangedSnapshot[0]).eq(toFullDigit(2500))
        expect(liquidityChangedSnapshot[1]).eq(toFullDigit(160))
        expect(liquidityChangedSnapshot[2]).eq("17777777777777777777")
    })

    it("decrease liquidity", async () => {
        // when amm.migrateLiquidity(0.5) from 80:1250 to 40:625
        // 133.33%
        expectEvent(await amm.migrateLiquidity(toDecimal(0.5)), "LiquidityChanged", {
            positionMultiplier: "1333333333333333333",
        })

        const reserve = await amm.getReserve()
        expect(reserve[0]).eq(toFullDigit(625))
        expect(reserve[1]).eq(toFullDigit(40))

        // 20 * 133.33% = 26.66
        const getBaseAssetDeltaThisFundingPeriod = await amm.getBaseAssetDeltaThisFundingPeriod()
        expect(getBaseAssetDeltaThisFundingPeriod).eq("-26666666666666666660")

        const getCumulativePositionMultiplier = await amm.getCumulativePositionMultiplier()
        expect(getCumulativePositionMultiplier).eq("1333333333333333333")

        const liquidityChangedSnapshot = await amm.liquidityChangedSnapshot()
        expect(liquidityChangedSnapshot[0]).eq(toFullDigit(625))
        expect(liquidityChangedSnapshot[1]).eq(toFullDigit(40))
        expect(liquidityChangedSnapshot[2]).eq("26666666666666666666")
    })

    it("will fail if the liquidity is the same", async () => {
        // when amm.migrateLiquidity(1) from 80:1250 to the same reserve
        // 133.33%
        await expectRevert(amm.migrateLiquidity(toDecimal(1)), "multiplier can't be 1")
    })
})
