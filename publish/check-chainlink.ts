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

    const [decimals, pair, latestPrice] = await Promise.all([
        aggregator.decimals(),
        aggregator.description(),
        aggregator.latestAnswer(),
    ])
    const [baseSymbol, quoteSymbol] = pair.split("/").map((symbol: string) => symbol.trim())
    const priceFeedKey = formatBytes32String(baseSymbol)
    const functionData = chainlinkInterface.encodeFunctionData("addAggregator", [priceFeedKey, address])
    const lines = [
        `pair: ${pair}`,
        `base symbol: ${baseSymbol}`,
        `quote symbol: ${quoteSymbol}`,
        `latest price: ${formatUnits(latestPrice, decimals)}`,
        `price feed key: ${priceFeedKey}`,
        `functionData: ${functionData}`,
    ]

    console.log(lines.join("\n"))
}
