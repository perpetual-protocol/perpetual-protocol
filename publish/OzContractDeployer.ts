import { NonceManager } from "@ethersproject/experimental"
import { ethers, upgrades } from "hardhat"

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

    async deploy(contractFileName: string, args: any[]): Promise<string> {
        // deploy contract by open zeppelin upgrade plugin
        const contract = await ethers.getContractFactory(contractFileName)
        const instance = await upgrades.deployProxy(contract, args, {
            initializer: this.ozInitMethodName,
            unsafeAllowCustomTypes: true,
        })
        await this.syncNonce(instance.deployTransaction.hash)
        return instance.address
    }

    async prepareUpgrade(proxy: string, contractFileName: string): Promise<string> {
        const factory = await ethers.getContractFactory(contractFileName)
        const address = await upgrades.prepareUpgrade(proxy, factory, {
            unsafeAllowCustomTypes: true,
        })
        console.log(`prepareUpgrade proxy=${proxy}, contractFileName=${contractFileName}, address=${address}`)
        return address
    }

    async upgrade(proxy: string, contractFileName: string): Promise<void> {
        const contract = await ethers.getContractFactory(contractFileName)
        const instance = await upgrades.upgradeProxy(proxy, contract, {
            unsafeAllowCustomTypes: true,
        })
        await this.syncNonce(instance.deployTransaction.hash)
    }
}
