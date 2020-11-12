import BN from "bn.js"
import { utils } from "ethers"
import { AmmContract, AmmInstance } from "types/truffle"
import { Layer, Network } from "../../scripts/common"
import { AmmContractName, ContractAlias, ContractName } from "../ContractName"
import { OzScript } from "../OzScript"
import { SettingsDao } from "../SettingsDao"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { AbstractContractWrapper } from "./AbstractContractWrapper"
import { PriceFeedKey } from "./L2PriceFeed"

interface AmmDeployArgs {
    quoteAssetReserve: BN
    baseAssetReserve: BN
    tradeLimitRatio: BN
    fundingPeriod: BN
    fluctuation: BN
    priceFeedKey: PriceFeedKey
    tollRatio: BN
    spreadRatio: BN
}

interface AmmProperties {
    maxHoldingBaseAsset: BN
}

type AmmConfig = { deployArgs: AmmDeployArgs; properties: AmmProperties }
type AmmConfigMap = { [contractAlias: string]: AmmConfig }
type AmmConfigMapByNetwork = {
    [network in Network]: AmmConfigMap
}

export class Amm extends AbstractContractWrapper<AmmContract, AmmInstance> {
    readonly contractFileName = ContractName.Amm
    private static btcUsdtConfig: AmmConfig = {
        deployArgs: {
            quoteAssetReserve: new BN(13095000 * 2).mul(Amm.DEFAULT_DIGITS),
            baseAssetReserve: new BN(1000 * 2).mul(Amm.DEFAULT_DIGITS),
            tradeLimitRatio: new BN(90).mul(Amm.DEFAULT_DIGITS).div(new BN(100)), // 90% trading limit ratio
            fundingPeriod: new BN(3600), // 1 hour
            fluctuation: new BN(0),
            priceFeedKey: PriceFeedKey.BTC,
            tollRatio: new BN(0).mul(Amm.DEFAULT_DIGITS).div(new BN(10000)), // 0.0%
            spreadRatio: new BN(10).mul(Amm.DEFAULT_DIGITS).div(new BN(10000)), // 0.1%
        },
        properties: {
            maxHoldingBaseAsset: new BN(0),
        },
    }
    private static ethUsdtConfig: AmmConfig = {
        deployArgs: {
            quoteAssetReserve: new BN(40958000).mul(Amm.DEFAULT_DIGITS),
            baseAssetReserve: new BN(100000).mul(Amm.DEFAULT_DIGITS),
            tradeLimitRatio: new BN(90).mul(Amm.DEFAULT_DIGITS).div(new BN(100)), // 90% trading limit ratio
            fundingPeriod: new BN(3600), // 1 hour
            fluctuation: new BN(0),
            priceFeedKey: PriceFeedKey.ETH,
            tollRatio: new BN(0).mul(Amm.DEFAULT_DIGITS).div(new BN(10000)), // 0.0%
            spreadRatio: new BN(10).mul(Amm.DEFAULT_DIGITS).div(new BN(10000)), // 0.1%
        },
        properties: {
            maxHoldingBaseAsset: new BN(0),
        },
    }
    protected static configs: AmmConfigMapByNetwork = {
        homestead: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        rinkeby: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        ropsten: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        kovan: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        xdai: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        sokol: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
        localhost: {
            [AmmContractName.BTCUSDT]: Amm.btcUsdtConfig,
            [AmmContractName.ETHUSDT]: Amm.ethUsdtConfig,
        },
    }

    constructor(
        protected readonly layerType: Layer,
        protected readonly settingsDao: SettingsDao,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly ozScript: OzScript,
        readonly contractAlias: ContractAlias,
    ) {
        super(layerType, settingsDao, systemMetadataDao, ozScript)
        this.contractAlias = contractAlias
    }

    async deploy(priceFeedAddress: string, quoteAssetAddress: string): Promise<AmmInstance> {
        const {
            quoteAssetReserve,
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            fluctuation,
            priceFeedKey,
            tollRatio,
            spreadRatio,
        } = this.deployArgs
        const priceFeedKeyBytes = utils.formatBytes32String(priceFeedKey.toString())
        return await super.deployUpgradableContract(
            quoteAssetReserve.toString(),
            baseAssetReserve.toString(),
            tradeLimitRatio.toString(),
            fundingPeriod.toString(),
            priceFeedAddress,
            priceFeedKeyBytes.toString(),
            quoteAssetAddress.toString(),
            fluctuation.toString(),
            tollRatio.toString(),
            spreadRatio.toString(),
        )
    }

    private ammConfigs(): AmmConfig {
        const network = this.systemMetadataDao.getNetwork(this.layerType)
        const configsByNetwork = Amm.configs[network]
        return configsByNetwork[this.contractAlias.toString()]
    }

    private get deployArgs(): AmmDeployArgs {
        return this.ammConfigs().deployArgs
    }

    public getAmmProperties(): AmmProperties {
        return this.ammConfigs().properties
    }
}
