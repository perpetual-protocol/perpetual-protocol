/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "hardhat"
import { HardhatRuntimeEnvironment } from "hardhat/types"
import { basename } from "path"
import { cp, mkdir, rm, test } from "shelljs"
import { AccountMetadata, ExternalContracts, Layer, Network, ozNetworkFile, Stage } from "../scripts/common"
import { getContractMetadataFile, getOpenZeppelinDir } from "../scripts/path"
import { ContractWrapperFactory } from "./contract/ContractWrapperFactory"
import { DeployConfig } from "./contract/DeployConfig"
import { SettingsDao } from "./SettingsDao"
import { SystemMetadataDao } from "./SystemMetadataDao"

export type MigrationTask = () => Promise<void>

export interface MigrationDefinition {
    configPath?: string
    getTasks: (context: MigrationContext) => MigrationTask[]
}

interface MigrationMetadata {
    batchIndex: number
    layer: Layer
}

export type Migration = MigrationDefinition & MigrationMetadata

export interface MigrationContext {
    stage: Stage
    layer: Layer
    settingsDao: SettingsDao
    systemMetadataDao: SystemMetadataDao
    externalContract: ExternalContracts
    deployConfig: DeployConfig
    factory: ContractWrapperFactory
}

export function extractMigrationMetadataFromPath(migrationPath: string): MigrationMetadata {
    const [batchStr, layerStr] = basename(migrationPath).split("-")
    const batchIndex = Number.parseInt(batchStr)
    if (Number.isNaN(batchIndex)) {
        throw new Error(`Invalid batch in migration file name: ${migrationPath}`)
    }
    let layer: Layer
    switch (layerStr) {
        case Layer.Layer1:
        case Layer.Layer2:
            layer = layerStr
            break
        default:
            throw new Error(`Invalid layer in migration file name: ${migrationPath}`)
    }
    return { batchIndex, layer }
}

async function logDeployer(): Promise<void> {
    const signers = await ethers.getSigners()
    const address = await signers[0].getAddress()
    console.log(`deployer=${address}`)
}

function generateContext(stage: Stage, layer: Layer): MigrationContext {
    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)

    const externalContract = settingsDao.getExternalContracts(layer)
    const deployConfig = new DeployConfig(settingsDao.stage)
    const factory = new ContractWrapperFactory(layer, systemMetadataDao, deployConfig.confirmations)
    return {
        stage,
        layer,
        settingsDao,
        systemMetadataDao,
        externalContract,
        deployConfig,
        factory,
    }
}

async function executeMigration(stage: Stage, migration: Migration): Promise<void> {
    const { layer, getTasks } = migration

    const context = generateContext(stage, layer)
    const { settingsDao } = context

    const tasks = getTasks(context)
    if (!tasks.length || !tasks) {
        return
    }

    console.log(`tasks: ${tasks.length}`)

    const { taskIndex: nextTaskIndex } = settingsDao.getNextMigration()
    for (let index = nextTaskIndex; index < tasks.length; index++) {
        const task = tasks[index]
        await task()
        settingsDao.increaseTaskIndex()
    }

    settingsDao.increaseBatchIndex()
}

export async function loadMigration(migrationPath: string): Promise<Migration> {
    const migrationMetadata = extractMigrationMetadataFromPath(migrationPath)
    const migrationDef = (await import(migrationPath)).default as MigrationDefinition
    return { ...migrationDef, ...migrationMetadata }
}

export async function migrate(stage: Stage, migrationPath: string, hre: HardhatRuntimeEnvironment): Promise<void> {
    const network = hre.network.name as Network

    // only expose accounts when deploy on local node, otherwise assign a empty array
    const isLocalhost: boolean = network === "localhost"
    const accounts = isLocalhost ? (hre.config.networks.hardhat.accounts as AccountMetadata[]) : []

    // Get nextMigration from setting file
    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    const nextMigration = settingsDao.getNextMigration()

    // load migration file
    const migration = await loadMigration(migrationPath)

    systemMetadataDao.setAccounts(migration.layer, accounts)

    // check if target migration is the next migration
    const { batchIndex: currentBatchIndex } = migration
    const { batchIndex: nextBatchIndex } = nextMigration
    if (nextBatchIndex !== currentBatchIndex) {
        throw new Error(
            `current batch (${currentBatchIndex}) is not the next batch (${nextBatchIndex}), are you sure the previous batches are completed?`,
        )
    }

    await logDeployer()

    // workaround: when deploying staging/production to the same network (eg. xdai)
    // we don't want to overwrite the .openzeppelin config file
    // so we'll keep the original file in our own dir (separate by different stage).
    const ozSettingsFileName = ozNetworkFile[network]
    const stagePath = `${getOpenZeppelinDir()}/${stage}`
    const sourceFile = `${stagePath}/${ozSettingsFileName}.json`
    const destinationFile = `${getOpenZeppelinDir()}/${ozSettingsFileName}.json`

    if (nextMigration.batchIndex === 0 && nextMigration.batchIndex === 0) {
        // first, remove .openzeppelin/${network}.json for the initial deploy
        rm(sourceFile)
        rm(destinationFile)
        rm(getContractMetadataFile(stage))

        // clear metadata
        systemMetadataDao.clearMetadata()
    }

    // 1. before deploying, copy from source to destination first
    // 2. during deploying, open zeppelin sdk will update the destination file
    // 3. after deploying, we'll copy the updated destination files back to the dir managed by us
    if (!test("-e", sourceFile)) {
        mkdir("-p", stagePath)
    } else {
        cp(sourceFile, destinationFile)
    }

    try {
        await executeMigration(stage, migration)
        console.log(`[contract deployment batch=${nextBatchIndex}] finished.`)
    } finally {
        cp(destinationFile, sourceFile)
    }
}
