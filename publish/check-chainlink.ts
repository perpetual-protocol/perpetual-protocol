import { formatBytes32String, formatUnits, Interface } from "ethers/lib/utils"
import fs from "fs"
import { artifacts } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import fetch from "node-fetch"
import { ContractFullyQualifiedName } from "./ContractName"

const CHAINLINK_L1_ABI =
    '[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"priceFeedL2","type":"address"}],"name":"PriceFeedL2Changed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"messageId","type":"bytes32"}],"name":"PriceUpdateMessageIdSent","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint80","name":"roundId","type":"uint80"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"PriceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"rootBridge","type":"address"}],"name":"RootBridgeChanged","type":"event"},{"inputs":[{"internalType":"bytes32","name":"_priceFeedKey","type":"bytes32"},{"internalType":"address","name":"_aggregator","type":"address"}],"name":"addAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"candidate","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_priceFeedKey","type":"bytes32"}],"name":"getAggregator","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_rootBridge","type":"address"},{"internalType":"address","name":"_priceFeedL2","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"prevTimestampMap","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"priceFeedKeys","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"priceFeedL2Address","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"priceFeedMap","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_priceFeedKey","type":"bytes32"}],"name":"removeAggregator","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"rootBridge","outputs":[{"internalType":"contract RootBridge","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_priceFeedL2","type":"address"}],"name":"setPriceFeedL2","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_rootBridge","type":"address"}],"name":"setRootBridge","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_priceFeedKey","type":"bytes32"}],"name":"updateLatestRoundData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"updateOwner","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
const L2_PRICE_FEED_ABI =
    '[{"type":"event","name":"OwnershipTransferred","inputs":[{"type":"address","name":"previousOwner","internalType":"address","indexed":true},{"type":"address","name":"newOwner","internalType":"address","indexed":true}],"anonymous":false},{"type":"event","name":"PriceFeedDataSet","inputs":[{"type":"bytes32","name":"key","internalType":"bytes32","indexed":false},{"type":"uint256","name":"price","internalType":"uint256","indexed":false},{"type":"uint256","name":"timestamp","internalType":"uint256","indexed":false},{"type":"uint256","name":"roundId","internalType":"uint256","indexed":false}],"anonymous":false},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"addAggregator","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"ambBridge","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"candidate","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getLatestTimestamp","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getPreviousPrice","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"},{"type":"uint256","name":"_numOfRoundBack","internalType":"uint256"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getPreviousTimestamp","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"},{"type":"uint256","name":"_numOfRoundBack","internalType":"uint256"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getPrice","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"length","internalType":"uint256"}],"name":"getPriceFeedLength","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getTwapPrice","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"},{"type":"uint256","name":"_interval","internalType":"uint256"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"initialize","inputs":[{"type":"address","name":"_ambBridge","internalType":"address"},{"type":"address","name":"_rootBridge","internalType":"address"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"owner","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"bytes32","name":"","internalType":"bytes32"}],"name":"priceFeedKeys","inputs":[{"type":"uint256","name":"","internalType":"uint256"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"bool","name":"registered","internalType":"bool"}],"name":"priceFeedMap","inputs":[{"type":"bytes32","name":"","internalType":"bytes32"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"removeAggregator","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"renounceOwnership","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"rootBridge","inputs":[]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setLatestData","inputs":[{"type":"bytes32","name":"_priceFeedKey","internalType":"bytes32"},{"type":"uint256","name":"_price","internalType":"uint256"},{"type":"uint256","name":"_timestamp","internalType":"uint256"},{"type":"uint256","name":"_roundId","internalType":"uint256"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setOwner","inputs":[{"type":"address","name":"newOwner","internalType":"address"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setRootBridge","inputs":[{"type":"address","name":"_rootBridge","internalType":"address"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"updateOwner","inputs":[]}]'
const INSURANCE_FUND_ABI =
    '[{"type":"event","name":"OwnershipTransferred","inputs":[{"type":"address","name":"previousOwner","internalType":"address","indexed":true},{"type":"address","name":"newOwner","internalType":"address","indexed":true}],"anonymous":false},{"type":"event","name":"ShutdownAllAmms","inputs":[{"type":"uint256","name":"blockNumber","internalType":"uint256","indexed":false}],"anonymous":false},{"type":"event","name":"TokenAdded","inputs":[{"type":"address","name":"tokenAddress","internalType":"address","indexed":false}],"anonymous":false},{"type":"event","name":"TokenRemoved","inputs":[{"type":"address","name":"tokenAddress","internalType":"address","indexed":false}],"anonymous":false},{"type":"event","name":"Withdrawn","inputs":[{"type":"address","name":"withdrawer","internalType":"address","indexed":false},{"type":"uint256","name":"amount","internalType":"uint256","indexed":false}],"anonymous":false},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"addAmm","inputs":[{"type":"address","name":"_amm","internalType":"contract IAmm"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"candidate","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"contract IExchangeWrapper"}],"name":"exchange","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address[]","name":"","internalType":"contract IAmm[]"}],"name":"getAllAmms","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"uint256","name":"","internalType":"uint256"}],"name":"getQuoteTokenLength","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"contract IInflationMonitor"}],"name":"inflationMonitor","inputs":[]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"initialize","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"bool","name":"","internalType":"bool"}],"name":"isExistedAmm","inputs":[{"type":"address","name":"_amm","internalType":"contract IAmm"}]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"contract IMinter"}],"name":"minter","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"address"}],"name":"owner","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"contract IERC20"}],"name":"perpToken","inputs":[]},{"type":"function","stateMutability":"view","outputs":[{"type":"address","name":"","internalType":"contract IERC20"}],"name":"quoteTokens","inputs":[{"type":"uint256","name":"","internalType":"uint256"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"removeAmm","inputs":[{"type":"address","name":"_amm","internalType":"contract IAmm"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"removeToken","inputs":[{"type":"address","name":"_token","internalType":"contract IERC20"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"renounceOwnership","inputs":[]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setBeneficiary","inputs":[{"type":"address","name":"_beneficiary","internalType":"address"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setExchange","inputs":[{"type":"address","name":"_exchange","internalType":"contract IExchangeWrapper"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setInflationMonitor","inputs":[{"type":"address","name":"_inflationMonitor","internalType":"contract IInflationMonitor"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setMinter","inputs":[{"type":"address","name":"_minter","internalType":"contract IMinter"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"setOwner","inputs":[{"type":"address","name":"newOwner","internalType":"address"}]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"shutdownAllAmm","inputs":[]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"updateOwner","inputs":[]},{"type":"function","stateMutability":"nonpayable","outputs":[],"name":"withdraw","inputs":[{"type":"address","name":"_quoteToken","internalType":"contract IERC20"},{"type":"tuple","name":"_amount","internalType":"struct Decimal.decimal","components":[{"type":"uint256","name":"d","internalType":"uint256"}]}]}]'
interface ContractMetadata {
    proxy: string
    abi: string
}
interface ContractMetadataSet {
    ChainlinkL1: ContractMetadata
    L2PriceFeed: ContractMetadata
    InsuranceFund: ContractMetadata
}

async function getContractMetadataSet(networkName: string): Promise<ContractMetadataSet> {
    const stage = networkName === "homestead" ? "production" : "staging"
    const metadata = await fetch(`https://metadata.perp.exchange/${stage}.json`).then(res => res.json())

    const metadataSet: ContractMetadataSet = {
        ChainlinkL1: {
            proxy: metadata.layers.layer1.contracts.ChainlinkL1.address,
            abi: CHAINLINK_L1_ABI,
        },
        L2PriceFeed: {
            proxy: metadata.layers.layer2.contracts.L2PriceFeed.address,
            abi: L2_PRICE_FEED_ABI,
        },
        InsuranceFund: {
            proxy: metadata.layers.layer2.contracts.InsuranceFund.address,
            abi: INSURANCE_FUND_ABI,
        },
    }

    return metadataSet
}

export async function checkChainlink(address: string, env: HardhatRuntimeEnvironment): Promise<void> {
    const AGGREGATOR_ABI = [
        "function decimals() view returns (uint8)",
        "function description() view returns (string memory)",
        "function latestAnswer() external view returns (int256)",
    ]

    const aggregator = await env.ethers.getContractAt(AGGREGATOR_ABI, address)

    const chainlinkL1Artifact = await artifacts.readArtifact(ContractFullyQualifiedName.ChainlinkL1)
    const chainlinkInterface = new Interface(chainlinkL1Artifact.abi)

    const l2PriceFeedArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.L2PriceFeed)
    const l2PriceFeedInterface = new Interface(l2PriceFeedArtifact.abi)

    const [decimals, pair, latestPrice] = await Promise.all([
        aggregator.decimals(),
        aggregator.description(),
        aggregator.latestAnswer(),
    ])
    const [baseSymbol, quoteSymbol] = pair.split("/").map((symbol: string) => symbol.trim())
    const priceFeedKey = formatBytes32String(baseSymbol)
    const functionDataL1 = chainlinkInterface.encodeFunctionData("addAggregator", [priceFeedKey, address])
    const functionDataL2 = l2PriceFeedInterface.encodeFunctionData("addAggregator", [priceFeedKey])
    const metadataSet = await getContractMetadataSet(env.network.name)
    const filename = `addAggregator_${env.network.name}.txt`
    const latestPriceNum = Number.parseFloat(formatUnits(latestPrice, decimals))
    const lines = [
        `pair: ${pair}`,
        `base symbol: ${baseSymbol}`,
        `quote symbol: ${quoteSymbol}`,
        `latest price: ${latestPriceNum}`,
        `maxHoldingBaseAsset (personal): ${100_000 / latestPriceNum}`,
        `openInterestNotionalCap (total): 2_000_000`,
        ``,
        `price feed key: ${priceFeedKey}`,
        `aggregator address: ${address}`,
        `functionData(ChainlinkL1,ChainlinkPriceFeed): ${functionDataL1}`,
        `functionData(L2PriceFeed): ${functionDataL2}`,
        "",
        "Copy lines below to setup environment variables:",
        `export ${env.network.name.toUpperCase()}_TOKEN_SYMBOL=${baseSymbol}`,
        `export ${env.network.name.toUpperCase()}_PRICE_FEED_KEY=${priceFeedKey}`,
        "",
        `ABI information for gnosis safe is saved to ${filename}`,
    ]

    const aggregatorInfoLines = [
        `ChainlinkL1 abi: ${metadataSet.ChainlinkL1.abi}`,
        `ChainlinkL1 proxy address: ${metadataSet.ChainlinkL1.proxy}`,
        "",
        `L2PriceFeed abi: ${metadataSet.L2PriceFeed.abi}`,
        `L2PriceFeed proxy address: ${metadataSet.L2PriceFeed.proxy}`,
        "",
        `InsuranceFund abi: ${metadataSet.InsuranceFund.abi}`,
        `InsuranceFund proxy address: ${metadataSet.InsuranceFund.proxy}`,
    ]
    await fs.promises.writeFile(filename, aggregatorInfoLines.join("\n"))

    console.log(lines.join("\n"))
}
