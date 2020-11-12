import { buidlerArguments } from "@nomiclabs/buidler"
import fs from "fs"
import { resolve } from "path"
import { ls } from "shelljs"
import { ARTIFACTS_DIR } from "../constants"
import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { asyncExec } from "../scripts/helper"
import { ContractMetadata, Network } from "./common"

function printByteCodeSize(contractName: string, artifactPath: string): number {
    const jsonStr = fs.readFileSync(artifactPath, "utf8")
    const artifact = JSON.parse(jsonStr)
    const size = artifact.deployedBytecode.length / 2 - 1

    const message = contractName + " : " + size + " bytes"
    if (size >= 24576) {
        console.log("\x1b[31m", message)
        console.log("\x1b[0m") // reset color
    } else {
        console.log(message)
    }
    return size
}

function printTopNContractSize(map: Map<string, number>): void {
    console.log("\n     === TOP 5 ===")

    const sortedMap = new Map([...map.entries()].sort((a, b) => b[1] - a[1]))
    let i = 0
    for (const [key, value] of sortedMap) {
        if (key.includes("Fake")) continue
        if (key.includes("Mock")) continue
        const message = key + " : " + value + " bytes"
        if (value >= 24576) {
            console.log("\x1b[31m", message)
            console.log("\x1b[0m") // reset color
        } else {
            console.log(message)
        }
        if (++i > 4) break
    }
}

function getContractName(fullPath: string): string {
    const start = fullPath.lastIndexOf("/") + 1
    const end = fullPath.lastIndexOf(".")
    return fullPath.substring(start, end)
}

function generateContractMetadata(): void {
    const map: Record<string, any> = {}
    const codeSizeMap = new Map()
    const artifactsDir = resolve(ARTIFACTS_DIR)
    ls(`${artifactsDir}/*.json`).map(fullPath => {
        const contractName = getContractName(fullPath)
        const metadata: ContractMetadata = {
            name: contractName,
            address: "",
        }
        map[contractName] = metadata
        codeSizeMap.set(contractName, printByteCodeSize(contractName, fullPath))
    })
    printTopNContractSize(codeSizeMap)

    const settingsDao = new SettingsDao("test")
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    systemMetadataDao.setLayerMetadata(
        "layer2", // for now, test stage builds put everything in layer2
        {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            network: buidlerArguments.network! as Network,
            contracts: map,
            accounts: [],
            externalContracts: {},
        },
    )
}

async function build(): Promise<void> {
    const artifactDir = resolve(ARTIFACTS_DIR)
    await asyncExec("buidler compile")
    await asyncExec(`typechain --target truffle-v5 ${artifactDir}/**/*.json --outDir ./types/truffle`)
    await asyncExec(`typechain --target web3-v1 ${artifactDir}/**/*.json --outDir ./types/web3`)
    await asyncExec(`typechain --target ethers-v5 ${artifactDir}/**/*.json --outDir ./types/ethers`)
    generateContractMetadata()
}

if (require.main === module) {
    build()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
