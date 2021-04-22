/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExecOptions } from "child_process"
import { promises } from "fs"
import path from "path"
import { loadMigration } from "../publish/Migration"
import { SettingsDao } from "../publish/SettingsDao"
import { Stage, TASK_MIGRATE } from "./common"
import { asyncExec } from "./helper"

const { readdir } = promises

export async function deploy(stage: Stage, options?: ExecOptions): Promise<void> {
    const settings = new SettingsDao(stage)

    if ("test" === stage) {
        settings.resetNextMigration()
    }
    const nextMigration = settings.getSystemDeploySettings().nextMigration

    const basePath = path.join(__dirname, "../publish/migrations")
    const filenames = await readdir(basePath)
    for (const filename of filenames) {
        const migrationPath = path.join(basePath, filename)
        const { batchIndex, layer, configPath } = await loadMigration(migrationPath)

        if (batchIndex < nextMigration.batchIndex) {
            console.info(`Skip migration: ${filename}`)
            continue
        }

        console.info(`Start migration: ${filename}`)
        const network = settings.getNetwork(layer)
        const configPathParam = configPath ? `--config ${configPath}` : ""
        const cmd = `hardhat --network ${network} ${configPathParam} ${TASK_MIGRATE} ${stage} ${migrationPath}`
        await asyncExec(cmd, options)
    }
}

/* eslint-disable no-console */
async function main(): Promise<void> {
    const stage = process.argv[2] as Stage
    await deploy(stage)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
