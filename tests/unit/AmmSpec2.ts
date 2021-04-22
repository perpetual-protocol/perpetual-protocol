import { use } from "chai"
import { deployContract, deployMockContract, MockContract, MockProvider, solidity } from "ethereum-waffle"
import { BigNumber, constants, utils } from "ethers"
import { parseEther } from "ethers/lib/utils"
import { artifacts } from "hardhat"
import { ContractFullyQualifiedName } from "../../publish/ContractName"
import { Amm } from "../../types/ethers/Amm"

use(solidity)

describe("Amm Unit Test 2 (Waffle)", async () => {
    const [wallet1, wallet2] = new MockProvider().getWallets()
    let amm: Amm
    let l2PriceFeed: MockContract
    let quoteToken: MockContract
    let clearingHouse: MockContract

    const AmmArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.Amm)
    const IERC20Artifact = await artifacts.readArtifact(ContractFullyQualifiedName.IERC20)
    const L2PriceFeedArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.L2PriceFeed)

    beforeEach(async () => {
        quoteToken = await deployMockContract(wallet1, IERC20Artifact.abi)
        clearingHouse = await deployMockContract(wallet1, [])
        l2PriceFeed = await deployMockContract(wallet1, L2PriceFeedArtifact.abi)
        amm = ((await deployContract(wallet1, AmmArtifact, [], { gasLimit: 6000000 })) as unknown) as Amm
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

    describe("setCap", () => {
        it("change maxHoldingBaseAsset and openInterestNotionalCap", async () => {
            await expect(amm.setCap({ d: 100 }, { d: 200 }))
                .to.emit(amm, "CapChanged")
                .withArgs("100", "200")
            expect((await amm.getMaxHoldingBaseAsset()).d).deep.eq(BigNumber.from(100))
            expect((await amm.getOpenInterestNotionalCap()).d).deep.eq(BigNumber.from(200))
        })
    })

    describe("setPriceFeed", () => {
        it("set priceFeed correctly", async () => {
            const updatedPriceFeed = "0x77F9710E7d0A19669A13c055F62cd80d313dF022"
            expect(await amm.priceFeed()).to.eq(l2PriceFeed.address)
            await expect(amm.setPriceFeed(updatedPriceFeed))
                .to.emit(amm, "PriceFeedUpdated")
                .withArgs(updatedPriceFeed)
            expect(await amm.priceFeed()).to.eq(updatedPriceFeed)
        })

        it("set priceFeed via non-owner causes revert transaction", async () => {
            await expect(amm.connect(wallet2).setPriceFeed(l2PriceFeed.address)).to.be.revertedWith(
                "PerpFiOwnableUpgrade: caller is not the owner",
            )
        })

        it("revert if priceFeed address is zero", async () => {
            await expect(amm.setPriceFeed(constants.AddressZero)).to.be.revertedWith("invalid PriceFeed address")
        })
    })
})
