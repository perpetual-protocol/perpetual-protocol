/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExecOptions } from "child_process"
import _ from "lodash"
import path from "path"
import { cp, mkdir, ShellString, test } from "shelljs"
import { parse as parseUrl } from "url"
import { HOMESTEAD_ARCHIVE_NODE_URL, RINKEBY_ARCHIVE_NODE_URL, XDAI_ARCHIVE_NODE_URL } from "../constants"
import { loadMigration } from "../publish/Migration"
import { SettingsDao } from "../publish/SettingsDao"
import { ozNetworkFile, Stage, TASK_SIMULATE } from "./common"
import { asyncExec } from "./helper"
import { getContractMetadataFile, getOpenZeppelinDir, getSettingsFile } from "./path"

// This script is for testing in the mainnet fork environment
export async function simulate(stage: Stage, migrationFileName: string, options?: ExecOptions): Promise<void> {
    if (stage !== "production" && stage !== "staging") {
        throw new Error('We only simulate migration for "production" or "staging"')
    }

    // convert relative path to absolute path
    const fullMigrationPath = path.join(__dirname, "..", "publish", "migrations", migrationFileName)

    // load migration file to get required parameters
    const { batchIndex, configPath, layer } = await loadMigration(fullMigrationPath)

    // determine netwok by stage & layer
    const settingsDao = new SettingsDao(stage)
    const sourceNetwork = settingsDao.getNetwork(layer)

    // copy files in OpenZeppelin's directory
    const ozSettingsFileName = ozNetworkFile[sourceNetwork]
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

    // clone settings
    const modifiedSettings = _.cloneDeep(settingsDao.settingsCached)

    // setting for both layers
    modifiedSettings.layers.layer1!.chainId = 31337
    modifiedSettings.layers.layer1!.network = "localhost"
    modifiedSettings.layers.layer2!.chainId = 31337
    modifiedSettings.layers.layer2!.network = "localhost"

    // allow migration with designated migration file/index
    modifiedSettings.nextMigration.batchIndex = batchIndex

    // write settings for simulation stage "test"
    const settingDestinationFile = getSettingsFile("test")
    ShellString(JSON.stringify(modifiedSettings, null, 2)).to(settingDestinationFile)
    console.log("%o copied", settingDestinationFile)

    // choose JSON-RPC URL to fork from
    let forkSource: string | undefined = undefined
    switch (sourceNetwork) {
        case "homestead":
            forkSource = HOMESTEAD_ARCHIVE_NODE_URL
            break
        case "rinkeby":
            forkSource = RINKEBY_ARCHIVE_NODE_URL
            break
        case "xdai":
            forkSource = XDAI_ARCHIVE_NODE_URL
            break
        default:
            throw new Error(
                `Unsupported network "${sourceNetwork}" (of stage: ${stage}, layer: ${layer}) or *_ARCHIVE_NODE_URL may not set properly`,
            )
    }
    console.log("Fork from %o (host name only)", parseUrl(forkSource).hostname)

    // execute simulation task
    const configPathParam = configPath ? `--config ${configPath}` : ""
    const cmd = `hardhat ${configPathParam} ${TASK_SIMULATE} --fork ${forkSource} ${fullMigrationPath}`
    await asyncExec(cmd, options)
}

/* eslint-disable no-console */
async function main(): Promise<void> {
    const stage = process.argv[2] as Stage
    const migrationPath = process.argv[3] as string
    await simulate(stage, migrationPath)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
