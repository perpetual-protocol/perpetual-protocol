/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import BN from "bn.js"
import { Layer } from "../../scripts/common"
import { ContractAlias } from "../ContractName"
import { OzScript } from "../OzScript"
import { SettingsDao } from "../SettingsDao"
import { SystemMetadataDao } from "../SystemMetadataDao"

// T: Contract
// K: ContractInstance
export abstract class AbstractContractWrapper<T extends Truffle.Contract<K>, K extends Truffle.ContractInstance> {
    static DEFAULT_DIGITS = new BN("1000000000000000000")
    protected static DEFAULT_LOCAL_NETWORK = "dev-31337"
    readonly contractAlias!: ContractAlias
    readonly contractFileName!: string

    constructor(
        protected readonly layerType: Layer,
        protected readonly settingsDao: SettingsDao,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly ozScript: OzScript,
    ) {}

    abstract async deploy(...args: any[]): Promise<K>

    protected async deployContract(...args: any[]): Promise<K> {
        const Contract = await ethers.getContractFactory(this.contractFileName)
        const deployedInstance = await Contract.deploy(...args)

        // write to metadata
        this.updateMetadata(deployedInstance.address)

        // return truffle contract
        const truffleInstance = await this.instance()
        return truffleInstance!
    }

    protected async deployUpgradableContract(...args: any[]): Promise<K> {
        const address = await this.ozScript.deploy(this.contractAlias, this.contractFileName, args)

        // write to metadata
        this.updateMetadata(address)

        // return truffle contract
        return (await this.instance())!
    }

    async upgradeContract(): Promise<void> {
        await this.ozScript.upgrade(this.address!, this.contractFileName)
    }

    async instance(): Promise<K | undefined> {
        return this.ozScript.getTruffleContractInstance(this.contractFileName, this.address)
    }

    private get address(): string | undefined {
        const metadata = this.systemMetadataDao.getContractMetadata(this.layerType, this.contractAlias)
        if (!metadata || !metadata.address) {
            console.error(`metadata not found, contractAlias=${this.contractAlias}`)
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
        this.systemMetadataDao.setContract(this.layerType, this.contractAlias, {
            name: this.contractFileName,
            address: address,
        })
    }
}
