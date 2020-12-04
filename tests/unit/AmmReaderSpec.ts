import { web3 } from "@nomiclabs/buidler"
import { default as BN } from "bn.js"
import { expect } from "chai"
import { AmmFakeInstance, AmmReaderInstance, ERC20FakeInstance, L2PriceFeedMockInstance } from "../../types/truffle"
import { deployAmm, deployAmmReader, deployErc20Fake, deployL2MockPriceFeed } from "../helper/contract"
import { toFullDigit } from "../helper/number"

describe.only("AmmReader Unit Test", () => {
    const ETH_PRICE = 100

    let amm: AmmFakeInstance
    let ammReader: AmmReaderInstance
    let l2PriceFeed: L2PriceFeedMockInstance
    let quoteToken: ERC20FakeInstance
    let admin: string

    beforeEach(async () => {
        const addresses = await web3.eth.getAccounts()
        admin = addresses[0]

        l2PriceFeed = await deployL2MockPriceFeed(toFullDigit(ETH_PRICE))
        quoteToken = await deployErc20Fake(toFullDigit(20000000))
        amm = await deployAmm({
            deployer: admin,
            quoteAssetTokenAddr: quoteToken.address,
            priceFeedAddr: l2PriceFeed.address,
            fluctuation: toFullDigit(0),
            fundingPeriod: new BN(3600), // 1 hour
        })
        await amm.setCounterParty(admin)

        ammReader = await deployAmmReader()
    })

    it("verify inputs & outputs", async () => {
        const {
            quoteAssetReserve,
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            quoteAssetSymbol,
            baseAssetSymbol,
            priceFeedKey,
            priceFeed,
        } = await ammReader.getAmmStates(amm.address)
        expect(quoteAssetReserve).to.deep.eq(1000)
        expect(baseAssetReserve).to.deep.eq(toFullDigit(100))
        expect(tradeLimitRatio).to.eq(toFullDigit(0.9))
        expect(fundingPeriod).to.eq("3600")
        expect(quoteAssetSymbol).to.eq("symbol")
        expect(baseAssetSymbol).to.eq("")
        expect(priceFeedKey).to.eq("ETH")
        expect(priceFeed).to.eq(l2PriceFeed.address)
    })
})
