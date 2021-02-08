import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { formatBytes32String, formatUnits, Interface } from "ethers/lib/utils"
import ChainlinkL1Artifact from "../build/contracts/ChainlinkL1.json"

const AGGREGATOR_ABI = [
    "function decimals() view returns (uint8)",
    "function description() view returns (string memory)",
    "function latestAnswer() external view returns (int256)",
]

export default {
    name: "check:chainlink",
    parameters: [
        {
            name: "address",
            description: "a Chainlink aggregator address",
        },
    ],
    action: async function checkChainlinkAction(tasksArgs: any, env: BuidlerRuntimeEnvironment): Promise<any> {
        const aggregator = await env.ethers.getContractAt(AGGREGATOR_ABI, tasksArgs.address)
        const chainlinkInterface = new Interface(ChainlinkL1Artifact.abi)

        const [decimals, pair, latestPrice] = await Promise.all([
            aggregator.decimals(),
            aggregator.description(),
            aggregator.latestAnswer(),
        ])
        const [baseSymbol, quoteSymbol] = pair.split("/").map((symbol: string) => symbol.trim())
        const priceFeedKey = formatBytes32String(baseSymbol)
        const functionData = chainlinkInterface.encodeFunctionData("addAggregator", [priceFeedKey, tasksArgs.address])
        const lines = [
            `pair: ${pair}`,
            `base symbol: ${baseSymbol}`,
            `quote symbol: ${quoteSymbol}`,
            `latest price: ${formatUnits(latestPrice, decimals)}`,
            `price feed key: ${priceFeedKey}`,
            `functionData: ${functionData}`,
        ]

        console.log(lines.join("\n"))
    },
}
