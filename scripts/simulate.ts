/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExecOptions } from "child_process"
import path from "path"
import { cp, mkdir, ShellString, test } from "shelljs"
import { loadMigration } from "../publish/Migration"
import { SettingsDao } from "../publish/SettingsDao"
import { Network, ozNetworkFile, Stage, TASK_MIGRATE } from "./common"
import { asyncExec } from "./helper"
import { getContractMetadataFile, getOpenZeppelinDir, getSettingsFile } from "./path"

// This script is for testing in the mainnet fork environment
// Remember to initiate the environment first: npx hardhat node --fork <archive-node-url>
export async function simulate(
    stage: Stage,
    network: Network,
    migrationFileName: string,
    options?: ExecOptions,
): Promise<void> {
    // copy files in OpenZeppelin's directory
    const ozSettingsFileName = ozNetworkFile[network]
    const stagePath = `${getOpenZeppelinDir()}/${stage}`
    const sourceFile = `${stagePath}/${ozSettingsFileName}.json`
    const destinationPath = `${getOpenZeppelinDir()}/test`
    const destinationFile = `${destinationPath}/unknown-31337.json`

    if (!test("-e", destinationPath)) {
        mkdir("-p", destinationPath)
    }
    cp(sourceFile, destinationFile)
    console.log("%o copied to %o", sourceFile, destinationFile)

    // copy files in metadata
    const metadataSourceFile = getContractMetadataFile(stage)
    const metadataDestinationFile = getContractMetadataFile("test")
    cp(metadataSourceFile, metadataDestinationFile)
    console.log("%o copied to %o", metadataSourceFile, metadataDestinationFile)

    // no need to input the directory path of the parameter 'migrationFileName'
    migrationFileName = path.join(__dirname, "..", "publish", "migrations", migrationFileName)
    const { batchIndex, configPath } = await loadMigration(migrationFileName)

    // copy files in publish/settings
    const settingDestinationFile = getSettingsFile("test")
    const settingsDao = new SettingsDao(stage)

    // setting for both layers
    settingsDao.settingsCached.layers.layer1!.chainId = 31337
    settingsDao.settingsCached.layers.layer1!.network = "localhost"
    settingsDao.settingsCached.layers.layer2!.chainId = 31337
    settingsDao.settingsCached.layers.layer2!.network = "localhost"

    // allow migration with designated migration file/index
    settingsDao.settingsCached.nextMigration.batchIndex = batchIndex

    ShellString(JSON.stringify(settingsDao.settingsCached, null, 2)).to(settingDestinationFile)
    console.log("%o copied", settingDestinationFile)

    const configPathParam = configPath ? `--config ${configPath}` : ""
    const simulationNetwork = "localhost"
    const cmd = `hardhat --network ${simulationNetwork} ${configPathParam} ${TASK_MIGRATE} test ${migrationFileName}`
    await asyncExec(cmd, options)
}

/* eslint-disable no-console */
async function main(): Promise<void> {
    const stage = process.argv[2] as Stage
    const network = process.argv[3] as Network
    const migrationPath = process.argv[4] as string
    await simulate(stage, network, migrationPath)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
