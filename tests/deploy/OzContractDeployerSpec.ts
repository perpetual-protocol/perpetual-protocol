import { ethers, upgrades } from "@nomiclabs/buidler"
import { use } from "chai"
import { MockProvider, solidity } from "ethereum-waffle"
import { ContractFactory } from "ethers"
import { OzContractDeployer } from "../../publish/OzContractDeployer"
import { UpgradableContractV1, UpgradableContractV2 } from "../../types/ethers"

use(solidity)

// conflict with buidler-gas-reporter without proxyResolver
describe.only("OzContractDeployer Spec", () => {
    const [wallet] = new MockProvider().getWallets()
    const ozContractDeployer: OzContractDeployer = new OzContractDeployer()
    const contractNameV1 = "UpgradableContractV1"
    const contractNameV2 = "UpgradableContractV2"
    let v1: UpgradableContractV1
    let v2: UpgradableContractV2
    let factoryV2: ContractFactory
    let proxyAddr: string

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

    describe("upgrade to v2", async () => {
        beforeEach(async () => {
            await ozContractDeployer.upgrade(proxyAddr, contractNameV2)
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
    })

    describe("prepareUpgrade to v2", async () => {
        let v2implAddr: string

        beforeEach(async () => {
            v2implAddr = await upgrades.prepareUpgrade(v1.address, factoryV2)
        })

        it("is not the same proxy address", async () => {
            expect(v2implAddr).not.eq(proxyAddr)
        })

        it("won't change state", async () => {
            expect((await v1.version()).toString()).eq("1")
        })

        it("proxy still has no new function", async () => {
            const wrongV2 = factoryV2.attach(proxyAddr) as UpgradableContractV2
            await expect(wrongV2.increaseVersion()).to.be.reverted
        })
    })

    describe("transferProxyAdminOwnership to others", async () => {
        it("can't transfer to empty address", async () => {
            await expect(OzContractDeployer.transferProxyAdminOwnership("0x0000000000000000000000000000000000000000"))
                .to.be.reverted
        })

        it("can't transfer and upgrade once transfer admin to others, but can deploy new and prepareUpgrade", async () => {
            await OzContractDeployer.transferProxyAdminOwnership(wallet.address)
            await expect(OzContractDeployer.transferProxyAdminOwnership(wallet.address)).to.be.reverted
            await expect(ozContractDeployer.upgrade(proxyAddr, contractNameV2)).to.be.reverted
            await upgrades.prepareUpgrade(v1.address, factoryV2)
            const newProxy = await ozContractDeployer.deploy(contractNameV2, [])
            await expect(ozContractDeployer.upgrade(newProxy, contractNameV1)).to.be.reverted
        })

        // once transferProxyAdminOwnership has been called, every admin-only tx won't be able to test
    })
})
