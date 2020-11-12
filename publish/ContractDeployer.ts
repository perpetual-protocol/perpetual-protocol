import { ethers } from "@nomiclabs/buidler"
import { ContractName } from "./ContractName"

export class ContractDeployer {
    constructor(readonly contractName: ContractName) {}

    async deploy(...args: any[]): Promise<string> {
        console.log(`deployContract: ${this.contractName}:[${args}]`)
        const factory = await ethers.getContractFactory(this.contractName)
        const instance = await factory.deploy(...args)
        return instance.address
    }
}
