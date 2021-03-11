/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Contract } from "ethers"
import { ethers } from "hardhat"
import { parseFullyQualifiedName } from "hardhat/utils/contract-names"
import { Layer } from "../../scripts/common"
import { ContractFullyQualifiedName, ContractId } from "../ContractName"
import { OzContractDeployer } from "../OzContractDeployer"
import { SystemMetadataDao } from "../SystemMetadataDao"

export class ContractWrapper<T extends Contract> {
    readonly ozContractDeployer: OzContractDeployer

    constructor(
        protected readonly layerType: Layer,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly fullyQualifiedContractName: ContractFullyQualifiedName,
        protected contractId: ContractId,
        readonly confirmations: number = 1,
    ) {
        this.ozContractDeployer = new OzContractDeployer(confirmations)
    }

    async deployImmutableContract(...args: any[]): Promise<T> {
        console.log(`deployImmutableContract: ${this.fullyQualifiedContractName}:[${args}]`)
        const factory = await ethers.getContractFactory(this.fullyQualifiedContractName)
        const instance = (await factory.deploy(...args)) as T
        this.updateMetadata(instance.address)
        await ethers.provider.waitForTransaction(instance.deployTransaction.hash, this.confirmations)
        return instance
    }

    async deployUpgradableContract(...args: any[]): Promise<T> {
        console.log(`deployUpgradableContract ${this.fullyQualifiedContractName}:[${args}]`)
        const address = await this.ozContractDeployer.deploy(this.fullyQualifiedContractName, args) // FQCN
        this.updateMetadata(address)
        return await this.instance()
    }

    async prepareUpgradeContract(): Promise<string> {
        return await this.ozContractDeployer.prepareUpgrade(this.address!, this.fullyQualifiedContractName)
    }

    async upgradeContract(): Promise<void> {
        await this.ozContractDeployer.upgrade(this.address!, this.fullyQualifiedContractName)
    }

    async instance(): Promise<T> {
        return (await ethers.getContractAt(this.fullyQualifiedContractName, this.address!)) as T
    }

    get address(): string | undefined {
        const metadata = this.systemMetadataDao.getContractMetadata(this.layerType, this.contractId)
        if (!metadata || !metadata.address) {
            console.error(`metadata not found, contractId=${this.contractId}`)
            return
        }

        const { contractName } = parseFullyQualifiedName(this.fullyQualifiedContractName)
        if (metadata.name !== contractName) {
            throw new Error(
                `contract file name mismatched, metadata=${metadata.name}, fullyQualifiedContractName=${this.fullyQualifiedContractName}`,
            )
        }
        return metadata.address
    }

    private updateMetadata(address: string): void {
        const { contractName } = parseFullyQualifiedName(this.fullyQualifiedContractName)
        this.systemMetadataDao.setContract(this.layerType, this.contractId, {
            name: contractName,
            address: address,
        })
    }
}
