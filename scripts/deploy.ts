/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { asyncExec } from "./helper"
import { Stage, TASK_DEPLOY_LAYER } from "./common"
import { ExecOptions } from "child_process"
import { SettingsDao } from "../publish/SettingsDao"

export async function deploy(stage: Stage, options?: ExecOptions): Promise<void> {
    const settings = new SettingsDao(stage)

    // test stage deploys only to layer2 and always restarts from initial version
    if ("test" === stage) {
        settings.setVersion("layer1", 0)
        settings.setVersion("layer2", 0)
    }

    // we have to break deployment up into multiple batches because:
    // (1) layer1 and layer2 contracts have circular dependencies
    // (2) buidler only works with one network at a time
    await asyncExec(
        `buidler --network ${settings.getNetwork("layer1")} ${TASK_DEPLOY_LAYER} ${stage} layer1 0`,
        options,
    )
    await asyncExec(
        `buidler --network ${settings.getNetwork("layer2")} ${TASK_DEPLOY_LAYER} ${stage} layer2 0`,
        options,
    )
    await asyncExec(
        `buidler --network ${settings.getNetwork("layer1")} ${TASK_DEPLOY_LAYER} ${stage} layer1 1`,
        options,
    )
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
