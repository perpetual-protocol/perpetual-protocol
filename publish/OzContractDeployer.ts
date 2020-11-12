import { ethers, upgrades } from "@nomiclabs/buidler"

// @openzeppelin wrapper
export class OzContractDeployer {
    constructor(readonly ozInitMethodName = "initialize") {}

    async deploy(contractFileName: string, args: any[]): Promise<string> {
        // deploy contract by open zeppelin upgrade plugin
        // ozScript won't replace the existing one, we have to manually remove it before deploy new contract first time
        console.log(`deployUpgradableContract: ${contractFileName}:[${args}]`)
        const contract = await ethers.getContractFactory(contractFileName)
        const instance = await upgrades.deployProxy(contract, args, {
            initializer: this.ozInitMethodName,
            unsafeAllowCustomTypes: true,
        })
        return instance.address
    }

    async prepareUpgrade(proxy: string, contractFileName: string): Promise<string> {
        const factory = await ethers.getContractFactory(contractFileName)
        return await upgrades.prepareUpgrade(proxy, factory)
    }

    async upgrade(proxy: string, contractFileName: string): Promise<void> {
        const contract = await ethers.getContractFactory(contractFileName)
        await upgrades.upgradeProxy(proxy, contract, {
            unsafeAllowCustomTypes: true,
        })
    }

    static async transferProxyAdminOwnership(newAdmin: string): Promise<void> {
        // TODO this is a hack due to @openzeppelin/buidler-upgrades doesn't expose "admin" in type-extensions.d.ts
        await (upgrades as any).admin.transferProxyAdminOwnership(newAdmin)
    }
}
