import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { formatBytes32String, formatUnits, Interface } from "ethers/lib/utils"

export async function checkChainlink(address: string, env: BuidlerRuntimeEnvironment): Promise<void> {
    const AGGREGATOR_ABI = [
        "function decimals() view returns (uint8)",
        "function description() view returns (string memory)",
        "function latestAnswer() external view returns (int256)",
    ]

    const aggregator = await env.ethers.getContractAt(AGGREGATOR_ABI, address)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chainlinkInterface = new Interface(require("../build/contracts/ChainlinkL1.json").abi)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const l2PriceFeedInterface = new Interface(require("../build/contracts/L2PriceFeed").abi)

    const [decimals, pair, latestPrice] = await Promise.all([
        aggregator.decimals(),
        aggregator.description(),
        aggregator.latestAnswer(),
    ])
    const [baseSymbol, quoteSymbol] = pair.split("/").map((symbol: string) => symbol.trim())
    const priceFeedKey = formatBytes32String(baseSymbol)
    const functionDataL1 = chainlinkInterface.encodeFunctionData("addAggregator", [priceFeedKey, address])
    const functionDataL2 = l2PriceFeedInterface.encodeFunctionData("addAggregator", [priceFeedKey])
    const lines = [
        `pair: ${pair}`,
        `base symbol: ${baseSymbol}`,
        `quote symbol: ${quoteSymbol}`,
        `latest price: ${formatUnits(latestPrice, decimals)}`,
        `price feed key: ${priceFeedKey}`,
        `functionData(L1): ${functionDataL1}`,
        `functionData(L2): ${functionDataL2}`,
    ]

    console.log(lines.join("\n"))
}
