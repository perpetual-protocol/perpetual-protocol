import { BigNumber } from "ethers"
import { Stage } from "../../scripts/common"
import { AmmInstanceName } from "../ContractName"

// TODO replace by ethers format
const DEFAULT_DIGITS = BigNumber.from(10).pow(18)

// chainlink
export enum PriceFeedKey {
    BTC = "BTC",
    ETH = "ETH",
    YFI = "YFI",
    DOT = "DOT",
    SDEFI = "sDEFI",
    SNX = "SNX",
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
    openInterestNotionalCap: BigNumber
}

export type AmmConfig = { deployArgs: AmmDeployArgs; properties: AmmProperties }
export type AmmConfigMap = Record<string, AmmConfig>
export const BTC_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        quoteAssetReserve: BigNumber.from(10000000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(500).mul(DEFAULT_DIGITS), // 500 BTC
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
            .div(100), // 0.25 BTC ~= $5000 USD,
        openInterestNotionalCap: BigNumber.from(DEFAULT_DIGITS).mul(500000), // $500K
    },
}

export const ETH_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        quoteAssetReserve: BigNumber.from(10000000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(20000).mul(DEFAULT_DIGITS), // 20000 ETH
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
        maxHoldingBaseAsset: DEFAULT_DIGITS.mul(10), // 10 ETH ~= $5000 USD
        openInterestNotionalCap: BigNumber.from(DEFAULT_DIGITS).mul(500000), // $500K
    },
}

export const YFI_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        quoteAssetReserve: BigNumber.from(4000000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(200).mul(DEFAULT_DIGITS), // 200 YFI
        tradeLimitRatio: BigNumber.from(90)
            .mul(DEFAULT_DIGITS)
            .div(100), // 90% trading limit ratio
        fundingPeriod: BigNumber.from(3600), // 1 hour
        fluctuation: BigNumber.from(12)
            .mul(DEFAULT_DIGITS)
            .div(1000), // 1.2%
        priceFeedKey: PriceFeedKey.YFI,
        tollRatio: BigNumber.from(0)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.0%
        spreadRatio: BigNumber.from(10)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.1%
    },
    properties: {
        maxHoldingBaseAsset: DEFAULT_DIGITS.mul(5).div(10), // 0.5 YFI ~= $10000 USD
        openInterestNotionalCap: BigNumber.from(DEFAULT_DIGITS).mul(1000000), // $1M
    },
}

export const DOT_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        // exact quote reserve amount will be overriden by the script based on the base reserve and the price upon deployment
        quoteAssetReserve: BigNumber.from(5_250_000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(300_000).mul(DEFAULT_DIGITS),
        tradeLimitRatio: BigNumber.from(90)
            .mul(DEFAULT_DIGITS)
            .div(100), // 90% trading limit ratio
        fundingPeriod: BigNumber.from(3600), // 1 hour
        fluctuation: BigNumber.from(12)
            .mul(DEFAULT_DIGITS)
            .div(1000), // 1.2%
        priceFeedKey: PriceFeedKey.DOT,
        tollRatio: BigNumber.from(0)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.0%
        spreadRatio: BigNumber.from(10)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.1%
    },
    properties: {
        maxHoldingBaseAsset: DEFAULT_DIGITS.mul(5_000), // 5000 DOT ~= $100,000 USD
        openInterestNotionalCap: BigNumber.from(DEFAULT_DIGITS).mul(2000000),
    },
}

export const SNX_USD_AMM: AmmConfig = {
    deployArgs: {
        // base * price
        // exact quote reserve amount will be overriden by the script based on the base reserve and the price upon deployment
        quoteAssetReserve: BigNumber.from(5_000_000).mul(DEFAULT_DIGITS),
        baseAssetReserve: BigNumber.from(300_000).mul(DEFAULT_DIGITS),
        tradeLimitRatio: BigNumber.from(90)
            .mul(DEFAULT_DIGITS)
            .div(100), // 90% trading limit ratio
        fundingPeriod: BigNumber.from(3600), // 1 hour
        fluctuation: BigNumber.from(12)
            .mul(DEFAULT_DIGITS)
            .div(1000), // 1.2%
        priceFeedKey: PriceFeedKey.SNX,
        tollRatio: BigNumber.from(0)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.0%
        spreadRatio: BigNumber.from(10)
            .mul(DEFAULT_DIGITS)
            .div(10000), // 0.1%
    },
    properties: {
        maxHoldingBaseAsset: DEFAULT_DIGITS.mul(6_000), // 6000 SNX ~= $100,000 USD
        openInterestNotionalCap: BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
    },
}

export class DeployConfig {
    // deploy
    readonly confirmations: number

    // chainlink
    readonly chainlinkMap: Record<string, string>

    // clearing house
    readonly initMarginRequirement = BigNumber.from(1)
        .mul(DEFAULT_DIGITS)
        .div(10) // 10% - 10x
    readonly maintenanceMarginRequirement = BigNumber.from(625)
        .mul(DEFAULT_DIGITS)
        .div(10000) // 6.25% - 16x
    readonly liquidationFeeRatio = BigNumber.from(125)
        .mul(DEFAULT_DIGITS)
        .div(10000) // 1.25%

    // amm
    readonly ammConfigMap: Record<string, AmmConfig> = {
        [AmmInstanceName.BTCUSDC]: BTC_USD_AMM,
        [AmmInstanceName.ETHUSDC]: ETH_USD_AMM,
        [AmmInstanceName.YFIUSDC]: YFI_USD_AMM,
        [AmmInstanceName.DOTUSDC]: DOT_USD_AMM,
        [AmmInstanceName.SNXUSDC]: SNX_USD_AMM,
    }

    constructor(stage: Stage) {
        switch (stage) {
            case "production":
                this.confirmations = 5
                this.chainlinkMap = {
                    [PriceFeedKey.BTC]: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
                    [PriceFeedKey.ETH]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
                    [PriceFeedKey.YFI]: "0xA027702dbb89fbd58938e4324ac03B58d812b0E1",
                    [PriceFeedKey.DOT]: "0x1C07AFb8E2B827c5A4739C6d59Ae3A5035f28734",
                    [PriceFeedKey.SNX]: "0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699",
                }
                break
            case "staging":
                this.confirmations = 5
                this.chainlinkMap = {
                    [PriceFeedKey.BTC]: "0xECe365B379E1dD183B20fc5f022230C044d51404",
                    [PriceFeedKey.ETH]: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
                    [PriceFeedKey.YFI]: "0xA027702dbb89fbd58938e4324ac03B58d812b0E1", // WARNING: there is no YFI/USD PriceFeed at Rinkeby
                    [PriceFeedKey.DOT]: "0x1C07AFb8E2B827c5A4739C6d59Ae3A5035f28734", // WARNING: there is no YFI/USD PriceFeed at Rinkeby
                    [PriceFeedKey.SDEFI]: "0x0630521aC362bc7A19a4eE44b57cE72Ea34AD01c",
                }
                break
            case "test":
                this.confirmations = 1
                this.chainlinkMap = {
                    // fake address
                    [PriceFeedKey.BTC]: "0xECe365B379E1dD183B20fc5f022230C044d51404",
                    [PriceFeedKey.ETH]: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
                    [PriceFeedKey.YFI]: "0xA027702dbb89fbd58938e4324ac03B58d812b0E1",
                    [PriceFeedKey.DOT]: "0x1C07AFb8E2B827c5A4739C6d59Ae3A5035f28734",
                }
                break
            default:
                throw new Error(`not supported stage=${stage}`)
        }
    }
}
