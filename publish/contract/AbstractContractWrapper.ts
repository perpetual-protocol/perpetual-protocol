/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import BN from "bn.js"
import { ContractAlias } from "../ContractName"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { OzScript } from "../OzScript"
import { Layer } from "../../scripts/common"
import { SettingsDao } from "../SettingsDao"
import { sleep } from "../../scripts/utils"

// T: Contract
// K: ContractInstance
export abstract class AbstractContractWrapper<T extends Truffle.Contract<K>, K> {
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
        const instance = await this.truffleContract.new(...args)

        // TODO this is a hack
        await sleep(10000)

        // write to metadata
        this.updateMetadata(instance.address)

        // return truffle contract
        return instance
    }

    protected async deployUpgradableContract(...args: any[]): Promise<K> {
        const address = await this.ozScript.deploy(this.contractAlias, this.contractFileName, args)

        // TODO this is a hack
        await sleep(10000)

        // write to metadata
        this.updateMetadata(address)

        // return truffle contract
        return (await this.instance())!
    }

    // TODO migrate to oz upgrade
    // async upgradeContract(): Promise<void> {
    //     await this.ozScript.upgrade(this.contractAlias, this.contractFileName)
    // }

    get truffleContract(): T {
        return artifacts.require<T>(this.contractFileName)
    }

    async instance(): Promise<K | undefined> {
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

        return this.ozScript.getTruffleContractInstance(this.contractFileName, metadata.address)
    }

    private updateMetadata(address: string): void {
        this.systemMetadataDao.setContract(this.layerType, this.contractAlias, {
            name: this.contractFileName,
            address: address,
        })
    }
}
