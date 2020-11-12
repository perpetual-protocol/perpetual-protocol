/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { utils } from "ethers"
import { L2PriceFeedContract, L2PriceFeedInstance } from "types/truffle"
import { sleep } from "../../scripts/utils"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export enum PriceFeedKey {
    BTC = "BTC",
    ETH = "ETH",
    LINK = "LINK",
}

export class L2PriceFeed extends AbstractContractWrapper<L2PriceFeedContract, L2PriceFeedInstance> {
    readonly contractAlias = ContractName.L2PriceFeed
    readonly contractFileName = ContractName.L2PriceFeed
    readonly aggregators = [PriceFeedKey.BTC, PriceFeedKey.ETH, PriceFeedKey.LINK]

    async deploy(ambBridgeOnXDai: string, l1PriceFeed: string): Promise<L2PriceFeedInstance> {
        return await super.deployUpgradableContract(ambBridgeOnXDai, l1PriceFeed)
    }

    async addAggregators(): Promise<void> {
        const instance = await this.instance()
        for (const priceFeedKey of this.aggregators) {
            await instance!.addAggregator(utils.formatBytes32String(priceFeedKey))
            // TODO this is a hack
            await sleep(10000)
        }
    }

    async addAggregator(priceFeedKey: PriceFeedKey): Promise<void> {
        const instance = await this.instance()
        await instance!.addAggregator(utils.formatBytes32String(priceFeedKey))
        // TODO this is a hack
        await sleep(10000)
    }
}
