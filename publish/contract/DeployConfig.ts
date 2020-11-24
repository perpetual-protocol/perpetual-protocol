import { BigNumber } from "ethers"
import { Stage } from "../../scripts/common"
import { AmmInstanceName } from "../ContractName"

// TODO replace by ethers format
const DEFAULT_DIGITS = BigNumber.from(10).pow(18)

// chainlink
export enum PriceFeedKey {
    BTC = "BTC",
    ETH = "ETH",
}

// amm
interface AmmDeployArgs {
    quoteAssetReserve: BigNumber
    baseAssetReserve: BigNumber
    tradeLimitRatio: BigNumber
    fundingPeriod: BigNumber
    fluctuation: BigNumber
    priceFeedKey: PriceFeedKey
    tollRatio: BigNumber
    spreadRatio: BigNumber
}

interface AmmProperties {
    maxHoldingBaseAsset: BigNumber
}

export type AmmConfig = { deployArgs: AmmDeployArgs; properties: AmmProperties }
export type AmmConfigMap = Record<string, AmmConfig>
export const BTC_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        quoteAssetReserve: BigNumber.from(10000000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(500).mul(DEFAULT_DIGITS),
        tradeLimitRatio: BigNumber.from(90)
            .mul(DEFAULT_DIGITS)
            .div(100), // 90% trading limit ratio
        fundingPeriod: BigNumber.from(3600), // 1 hour
        fluctuation: BigNumber.from(12)
            .mul(DEFAULT_DIGITS)
            .div(1000), // 1.2%
        priceFeedKey: PriceFeedKey.BTC,
        tollRatio: BigNumber.from(0)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.0%
        spreadRatio: BigNumber.from(10)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.1%
    },
    properties: {
        maxHoldingBaseAsset: BigNumber.from(DEFAULT_DIGITS)
            .mul(25)
            .div(1000), // 0.25 BTC ~= $5000 USD
    },
}

export const ETH_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        quoteAssetReserve: BigNumber.from(5000000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(10000).mul(DEFAULT_DIGITS),
        tradeLimitRatio: BigNumber.from(90)
            .mul(DEFAULT_DIGITS)
            .div(100), // 90% trading limit ratio
        fundingPeriod: BigNumber.from(3600), // 1 hour
        fluctuation: BigNumber.from(12)
            .mul(DEFAULT_DIGITS)
            .div(1000), // 1.2%
        priceFeedKey: PriceFeedKey.ETH,
        tollRatio: BigNumber.from(0)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.0%
        spreadRatio: BigNumber.from(10)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.1%
    },
    properties: {
        maxHoldingBaseAsset: BigNumber.from(10), // 10 ETH ~= $5000 USD
    },
}

export class DeployConfig {
    // deploy
    readonly confirmations: number

    // chainlink
    readonly chainlinkMap: Record<string, string>

    // clearing house
    readonly initMarginRequirement = BigNumber.from(5)
        .mul(DEFAULT_DIGITS)
        .div(100) // 5%
    readonly maintenanceMarginRequirement = BigNumber.from(25)
        .mul(DEFAULT_DIGITS)
        .div(1000) // 2.5%
    readonly liquidationFeeRatio = BigNumber.from(125)
        .mul(DEFAULT_DIGITS)
        .div(10000) // 1.25%

    // amm
    readonly ammConfigMap: Record<string, AmmConfig> = {
        [AmmInstanceName.BTCUSDC]: BTC_USD_AMM,
        [AmmInstanceName.ETHUSDC]: ETH_USD_AMM,
    }

    constructor(stage: Stage) {
        switch (stage) {
            case "production":
                this.confirmations = 5
                this.chainlinkMap = {
                    [PriceFeedKey.BTC]: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
                    [PriceFeedKey.ETH]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
                }
                break
            case "staging":
                this.confirmations = 5
                this.chainlinkMap = {
                    [PriceFeedKey.BTC]: "0xECe365B379E1dD183B20fc5f022230C044d51404",
                    [PriceFeedKey.ETH]: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
                }
                break
            case "test":
                this.confirmations = 1
                this.chainlinkMap = {
                    // fake address
                    [PriceFeedKey.BTC]: "0xECe365B379E1dD183B20fc5f022230C044d51404",
                    [PriceFeedKey.ETH]: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
                }
                break
            default:
                throw new Error(`not supported stage=${stage}`)
        }
    }
}
