/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { utils } from "ethers"
import { ChainlinkL1Contract, ChainlinkL1Instance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export enum PriceFeedKey {
    BTC = "BTC",
    ETH = "ETH",
    LINK = "LINK",
}

type PriceFeedMapByNetwork = { [network: string]: PriceFeedMap }
type PriceFeedMap = { [key: string]: string }

export class ChainlinkL1 extends AbstractContractWrapper<ChainlinkL1Contract, ChainlinkL1Instance> {
    readonly contractAlias = ContractName.ChainlinkL1
    readonly contractFileName = ContractName.ChainlinkL1
    readonly aggregators: PriceFeedMapByNetwork = {
        // https://docs.chain.link/docs/reference-contracts
        ropsten: {
            [PriceFeedKey.BTC]: "0x0d5C2eC3A235D0DDfB98dbe058F790Eff0c34782",
            [PriceFeedKey.ETH]: "0x30B5068156688f818cEa0874B580206dFe081a03",
            [PriceFeedKey.LINK]: "0x40c9885aa8213B40e3E8a0a9aaE69d4fb5915a3A",
        },
        kovan: {
            [PriceFeedKey.BTC]: "0x6135b13325bfC4B00278B4abC5e20bbce2D6580e",
            [PriceFeedKey.ETH]: "0x9326BFA02ADD2366b30bacB125260Af641031331",
            [PriceFeedKey.LINK]: "0x396c5E36DD0a0F5a5D33dae44368D4193f69a1F0",
        },
        mainnet: {
            [PriceFeedKey.BTC]: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
            [PriceFeedKey.ETH]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            [PriceFeedKey.LINK]: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
        },
        rinkeby: {
            [PriceFeedKey.BTC]: "0xECe365B379E1dD183B20fc5f022230C044d51404",
            [PriceFeedKey.ETH]: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
            [PriceFeedKey.LINK]: "0xd8bD0a1cB028a31AA859A21A3758685a95dE4623",
        },
    }

    async deploy(rootBridge: string, priceFeed: string): Promise<ChainlinkL1Instance> {
        return await super.deployUpgradableContract(rootBridge, priceFeed)
    }

    async addAggregators(): Promise<void> {
        const instance = await this.instance()
        const network = this.systemMetadataDao.getNetwork(this.layerType)
        const aggregatorsByNetwork = this.aggregators[network]
        for (const priceFeedKey in aggregatorsByNetwork) {
            const address = aggregatorsByNetwork[priceFeedKey]
            await instance!.addAggregator(utils.formatBytes32String(priceFeedKey.toString()), address)
        }
    }

    async addAggregator(priceFeedKey: PriceFeedKey): Promise<void> {
        const instance = await this.instance()
        const network = this.systemMetadataDao.getNetwork(this.layerType)
        const aggregatorsByNetwork = this.aggregators[network]
        await instance!.addAggregator(
            utils.formatBytes32String(priceFeedKey.toString()),
            aggregatorsByNetwork[priceFeedKey],
        )
    }
}
