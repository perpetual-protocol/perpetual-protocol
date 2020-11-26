import { use } from "chai"
import { deployContract, deployMockContract, MockContract, MockProvider, solidity } from "ethereum-waffle"
import { BigNumber, utils } from "ethers"
import { parseEther } from "ethers/lib/utils"
import AmmArtifact from "../../build/contracts/Amm.json"
import IERC20Artifact from "../../build/contracts/IERC20.json"
import L2PriceFeedArtifact from "../../build/contracts/L2PriceFeed.json"
import { Amm } from "../../types/ethers/Amm"

use(solidity)

describe("Amm Unit Test 2 (Waffle)", () => {
    const [wallet] = new MockProvider().getWallets()
    let amm: Amm
    let l2PriceFeed: MockContract
    let quoteToken: MockContract
    let clearingHouse: MockContract

    beforeEach(async () => {
        quoteToken = await deployMockContract(wallet, IERC20Artifact.abi)
        clearingHouse = await deployMockContract(wallet, [])
        l2PriceFeed = await deployMockContract(wallet, L2PriceFeedArtifact.abi)
        amm = ((await deployContract(wallet, AmmArtifact)) as unknown) as Amm
        await amm.initialize(
            parseEther("1000"),
            parseEther("100"),
            parseEther("0.9"), // tradeLimitRatio
            parseEther("3600"), // fundingPeriod - 1hr
            l2PriceFeed.address,
            utils.formatBytes32String("ETH"),
            quoteToken.address,
            BigNumber.from(0), // fluctuation
            BigNumber.from(0), // toll
            BigNumber.from(0), // spread
        )
        await amm.setCounterParty(clearingHouse.address)
        amm.connect(clearingHouse.address)
    })

    describe("price", () => {
        it("getUnderlyingPrice", async () => {
            const price = parseEther("1")
            const priceFeedKeyBytes32 = await amm.priceFeedKey()
            const priceFeedKeyStr = utils.parseBytes32String(priceFeedKeyBytes32)
            expect(priceFeedKeyStr).eq("ETH")
            await l2PriceFeed.mock.getPrice.withArgs(priceFeedKeyBytes32).returns(price)
            expect((await amm.getUnderlyingPrice()).d).deep.eq(price)
        })
    })
})
