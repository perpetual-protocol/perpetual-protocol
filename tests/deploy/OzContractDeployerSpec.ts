import { expectRevert } from "@openzeppelin/test-helpers"
import { expect, use } from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { ContractFactory } from "ethers"
import { ethers, upgrades } from "hardhat"
import { OzContractDeployer } from "../../publish/OzContractDeployer"
import { UpgradableContractV1, UpgradableContractV2 } from "../../types/ethers"

use(solidity)

// conflict with hardhat-gas-reporter without proxyResolver
describe("OzContractDeployer Spec", () => {
    const [wallet] = new MockProvider().getWallets()
    const ozContractDeployer: OzContractDeployer = new OzContractDeployer()
    const contractNameV1 = "src/mock/UpgradableContractV1.sol:UpgradableContractV1"
    const contractNameV2 = "src/mock/UpgradableContractV2.sol:UpgradableContractV2"
    // the following two are proxys
    let v1: UpgradableContractV1
    let v2: UpgradableContractV2
    let factoryV2: ContractFactory
    let proxyAddr: string

    async function getImplementation(proxyAddr: string) {
        const proxyAdmin = await upgrades.admin.getInstance()
        return proxyAdmin.getProxyImplementation(proxyAddr)
    }

    beforeEach(async () => {
        factoryV2 = await ethers.getContractFactory(contractNameV2)
        proxyAddr = await ozContractDeployer.deploy(contractNameV1, [])
        v1 = (await ethers.getContractAt(contractNameV1, proxyAddr)) as UpgradableContractV1
    })

    it("retrieve version that's initialized", async () => {
        expect((await v1.version()).toString()).eq("1")
    })

    it("doesn't have increaseVersion function", async () => {
        const wrongV2 = factoryV2.attach(proxyAddr) as UpgradableContractV2
        await expect(wrongV2.increaseVersion()).to.be.reverted
    })

    it("force error, initialization is included in ozContractDeployer.deploy()", async () => {
        const v1ImplAddr = await getImplementation(proxyAddr)
        const v1Impl = (await ethers.getContractAt(contractNameV1, v1ImplAddr)) as UpgradableContractV1
        await expectRevert(v1Impl.initialize(), "Contract instance has already been initialized")
    })

    describe("upgrade to v2", () => {
        beforeEach(async () => {
            await ozContractDeployer.upgrade(proxyAddr, contractNameV2, [])
            v2 = (await ethers.getContractAt(contractNameV2, proxyAddr)) as UpgradableContractV2
        })

        it("won't change the proxy address", async () => {
            expect(v2.address).eq(proxyAddr)
        })

        it("won't change state", async () => {
            expect((await v2.version()).toString()).eq("1")
        })

        it("has a new function", async () => {
            await v2.increaseVersion()
            expect((await v1.version()).toString()).eq("2")
        })

        it("force error, initialization is included in ozContractDeployer.upgrade()", async () => {
            const v2ImplAddr = await getImplementation(v2.address)
            const v2Impl = (await ethers.getContractAt(contractNameV2, v2ImplAddr)) as UpgradableContractV2
            await expectRevert(v2Impl.initialize(), "Contract instance has already been initialized")
        })
    })

    describe("prepareUpgrade to v2", () => {
        let v2ImplAddr: string

        beforeEach(async () => {
            v2ImplAddr = await ozContractDeployer.prepareUpgrade(proxyAddr, contractNameV2, [])
        })

        it("ozContractDeployer.prepareUpgrade() returns the implementation address; will be different from proxy address", async () => {
            expect(v2ImplAddr).not.eq(proxyAddr)
        })

        it("won't change state", async () => {
            expect((await v1.version()).toString()).eq("1")
        })

        it("proxy still has no new function", async () => {
            const wrongV2 = factoryV2.attach(proxyAddr) as UpgradableContractV2
            await expect(wrongV2.increaseVersion()).to.be.reverted
        })

        it("force error, initialization is included in ozContractDeployer.prepareUpgrade()", async () => {
            const v2Impl = (await ethers.getContractAt(contractNameV2, v2ImplAddr)) as UpgradableContractV2
            await expectRevert(v2Impl.initialize(), "Contract instance has already been initialized")
        })
    })

    describe("transferProxyAdminOwnership to others", () => {
        it("can't transfer to empty address", async () => {
            await expect(OzContractDeployer.transferProxyAdminOwnership("0x0000000000000000000000000000000000000000"))
                .to.be.reverted
        })

        it("can't transfer and upgrade once transfer admin to others, but can deploy new and prepareUpgrade", async () => {
            await OzContractDeployer.transferProxyAdminOwnership(wallet.address)
            await expect(OzContractDeployer.transferProxyAdminOwnership(wallet.address)).to.be.reverted
            await expect(ozContractDeployer.upgrade(proxyAddr, contractNameV2, [])).to.be.reverted
            await upgrades.prepareUpgrade(v1.address, factoryV2)
            const newProxy = await ozContractDeployer.deploy(contractNameV2, [])
            await expect(ozContractDeployer.upgrade(newProxy, contractNameV1, [])).to.be.reverted
        })

        // once transferProxyAdminOwnership has been called, every admin-only tx won't be able to test
    })
})
