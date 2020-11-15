/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { Contract } from "ethers"
import { Layer } from "../../scripts/common"
import { ContractInstanceName, ContractName } from "../ContractName"
import { OzContractDeployer } from "../OzContractDeployer"
import { SystemMetadataDao } from "../SystemMetadataDao"

export class ContractWrapper<T extends Contract> {
    readonly ozContractDeployer: OzContractDeployer

    constructor(
        protected readonly layerType: Layer,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly contractFileName: ContractName,
        protected contractInstanceName: ContractInstanceName,
        confirmations: number = 1,
    ) {
        this.ozContractDeployer = new OzContractDeployer(confirmations)
    }

    async deployImmutableContract(...args: any[]): Promise<T> {
        console.log(`deployImmutableContract: ${this.contractFileName}:[${args}]`)
        const factory = await ethers.getContractFactory(this.contractFileName)
        const instance = (await factory.deploy(...args)) as T
        this.updateMetadata(instance.address)

        return instance
    }

    async deployUpgradableContract(...args: any[]): Promise<T> {
        console.log(`deployUpgradableContract ${this.contractFileName}:[${args}]`)
        const address = await this.ozContractDeployer.deploy(this.contractFileName, args)
        this.updateMetadata(address)
        return await this.instance()
    }

    async prepareUpgradeContract(): Promise<string> {
        return await this.ozContractDeployer.prepareUpgrade(this.address!, this.contractFileName)
    }

    async upgradeContract(): Promise<void> {
        await this.ozContractDeployer.upgrade(this.address!, this.contractFileName)
    }

    async instance(): Promise<T> {
        return (await ethers.getContractAt(this.contractFileName, this.address!)) as T
    }

    get address(): string | undefined {
        const metadata = this.systemMetadataDao.getContractMetadata(this.layerType, this.contractInstanceName)
        if (!metadata || !metadata.address) {
            console.error(`metadata not found, contractInstanceName=${this.contractInstanceName}`)
            return
        }

        if (metadata.name !== this.contractFileName) {
            throw new Error(
                `contract file name mismatched, metadata=${metadata.name}, contractFileName=${this.contractFileName}`,
            )
        }
        return metadata.address
    }

    private updateMetadata(address: string): void {
        this.systemMetadataDao.setContract(this.layerType, this.contractInstanceName, {
            name: this.contractFileName,
            address: address,
        })
    }
}
