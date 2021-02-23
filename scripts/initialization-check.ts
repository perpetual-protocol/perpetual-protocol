import { Fragment, JsonFragment } from "@ethersproject/abi"
import { BigNumber, Contract, ethers } from "ethers"
import fetch from "node-fetch"

const xdaiProvider = new ethers.providers.JsonRpcProvider("https://rpc.xdaichain.com/")
const l1Provider = ethers.getDefaultProvider("mainnet")

function instance(
    address: string,
    abi: Array<string | Fragment | JsonFragment>,
    provider: ethers.providers.BaseProvider,
): Contract {
    return new ethers.Contract(address, abi, provider) as Contract
}

async function check(contracts: any, proxyAdminAddr: string, provider: ethers.providers.BaseProvider) {
    const ownableAbi = ["function owner() view returns (address) "]
    const proxyAdminAbi = ["function getProxyImplementation(address proxy) view returns (address)"]

    for (const contract in contracts) {
        const contractInfo = contracts[contract]
        console.log("#", contractInfo["name"])

        const proxyAdmin = instance(proxyAdminAddr, proxyAdminAbi, provider)
        let implAddr
        try {
            implAddr = await proxyAdmin.getProxyImplementation(contractInfo["address"])
        } catch (e) {
            console.log("\x1b[33m can't get implementation")
            console.log("\x1b[0m") // reset color
            continue
        }
        console.log(" - implementation addr", implAddr)

        const implInstance = instance(implAddr, ownableAbi, provider)
        const owner = (await implInstance.owner()).toString()
        if (BigNumber.from(owner).eq(BigNumber.from("0"))) {
            console.log("\x1b[31m [error!] owner is empty")
            console.log("\x1b[0m") // reset color
        } else {
            console.log(" - owner", owner)
        }
    }
}

async function initializationCheck(): Promise<void> {
    const results = await fetch(`https://metadata.perp.exchange/production.json`)
    const json = await results.json()
    const jsonLayer1 = json["layers"]["layer1"]
    const jsonLayer2 = json["layers"]["layer2"]
    const layer1ProxyAdmin = jsonLayer1["externalContracts"]["proxyAdmin"]
    const layer2ProxyAdmin = jsonLayer2["externalContracts"]["proxyAdmin"]
    const layer1Contracts = jsonLayer1["contracts"]
    const layer2Contracts = jsonLayer2["contracts"]

    console.log("===== Ethereum =====")
    await check(layer1Contracts, layer1ProxyAdmin, l1Provider)
    console.log("===== xDai =====")
    await check(layer2Contracts, layer2ProxyAdmin, xdaiProvider)
}

if (require.main === module) {
    initializationCheck()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
