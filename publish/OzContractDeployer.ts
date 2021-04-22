import { NonceManager } from "@ethersproject/experimental"
import { ethers, upgrades } from "hardhat"
import { getImplementation, initImplementation } from "./contract/DeployUtil"

// @openzeppelin wrapper
export class OzContractDeployer {
    constructor(readonly confirmations: number = 1, readonly ozInitMethodName = "initialize") {}

    static async transferProxyAdminOwnership(newAdmin: string): Promise<void> {
        // TODO this is a hack due to @openzeppelin/hardhat-upgrades doesn't expose "admin" in type-extensions.d.ts
        await (upgrades as any).admin.transferProxyAdminOwnership(newAdmin)
    }

    // when using open zeppelin upgrade plugin to deploy contract, local nonce is not increasing automatically
    private async syncNonce(txHash: string): Promise<void> {
        const signers = await ethers.getSigners()
        const signer = signers[0]
        const nonceManager = new NonceManager(signer)
        await ethers.provider.waitForTransaction(txHash, this.confirmations)
        const nonce = await signer.getTransactionCount()
        nonceManager.setTransactionCount(nonce)
    }

    async deploy(contractFullyQualifiedName: string, args: any[]): Promise<string> {
        // deploy contract by open zeppelin upgrade plugin
        const contract = await ethers.getContractFactory(contractFullyQualifiedName)
        const proxyInstance = await upgrades.deployProxy(contract, args, {
            initializer: this.ozInitMethodName,
        })

        await this.syncNonce(proxyInstance.deployTransaction.hash)

        const impAddr = await getImplementation(proxyInstance.address)
        console.log(
            `deploy: contractFullyQualifiedName=${contractFullyQualifiedName}, proxy=${proxyInstance.address}, implementation=${impAddr}`,
        )
        await initImplementation(impAddr, contractFullyQualifiedName, this.confirmations, args)
        return proxyInstance.address
    }

    // different from deploy() and upgrade(), this function returns the "implementation" address
    async prepareUpgrade(proxy: string, contractFullyQualifiedName: string, args: any[]): Promise<string> {
        const factory = await ethers.getContractFactory(contractFullyQualifiedName)
        const impAddr = await upgrades.prepareUpgrade(proxy, factory, { unsafeAllowCustomTypes: true })
        console.log(
            `prepareUpgrade: contractFullyQualifiedName=${contractFullyQualifiedName}, proxy=${proxy}, implementation=${impAddr}`,
        )

        await initImplementation(impAddr, contractFullyQualifiedName, this.confirmations, args)
        // proxyInstance.deployTransaction only exists in deployProxy() and does not exist in prepareUpgrade()
        return impAddr
    }

    // only admin
    async upgrade(proxy: string, contractFullyQualifiedName: string, args: any[]): Promise<void> {
        const contract = await ethers.getContractFactory(contractFullyQualifiedName)
        const proxyInstance = await upgrades.upgradeProxy(proxy, contract)
        const impAddr = await getImplementation(proxyInstance.address)
        console.log(
            `upgrade: contractFullyQualifiedName=${contractFullyQualifiedName}, proxy=${proxy}, implementation=${impAddr}`,
        )

        await initImplementation(impAddr, contractFullyQualifiedName, this.confirmations, args)
        // proxyInstance.deployTransaction only exists in deployProxy() and does not exist in upgradeProxy()
        // await this.syncNonce(proxyInstance.deployTransaction.hash)
    }

    async prepareUpgradeLegacy(proxy: string, contractFullyQualifiedName: string): Promise<string> {
        const factory = await ethers.getContractFactory(contractFullyQualifiedName)
        const impAddr = await upgrades.prepareUpgrade(proxy, factory)
        console.log(
            `prepareUpgradeLegacy proxy=${proxy}, contractFullyQualifiedName=${contractFullyQualifiedName}, address=${impAddr}`,
        )
        return impAddr
    }
}
