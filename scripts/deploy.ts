/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExecOptions } from "child_process"
import { SettingsDao } from "../publish/SettingsDao"
import { Stage, TASK_DEPLOY_LAYER } from "./common"
import { asyncExec } from "./helper"

export async function deploy(stage: Stage, options?: ExecOptions): Promise<void> {
    const settings = new SettingsDao(stage)
    const layer1Network = settings.getNetwork("layer1")
    const layer2Network = settings.getNetwork("layer2")

    // test stage deploys only to layer2 and always restarts from initial version
    if ("test" === stage) {
        settings.setVersion("layer1", 0)
        settings.setVersion("layer2", 0)
    }

    // #1
    // we have to break deployment up into multiple batches because:
    // (1) layer1 and layer2 contracts have circular dependencies
    // (2) buidler only works with one network at a time

    // V1
    await asyncExec(`buidler --network ${layer1Network} ${TASK_DEPLOY_LAYER} ${stage} layer1 0`, options)
    await asyncExec(`buidler --network ${layer2Network} ${TASK_DEPLOY_LAYER} ${stage} layer2 0`, options)
    await asyncExec(`buidler --network ${layer1Network} ${TASK_DEPLOY_LAYER} ${stage} layer1 1`, options)
    await asyncExec(
        `buidler --network ${layer2Network} --config buidler.flatten.clearinghouse.config.ts ${TASK_DEPLOY_LAYER} ${stage} layer2 1`,
        options,
    )
    await asyncExec(
        `buidler --network ${layer2Network} --config buidler.flatten.amm.config.ts ${TASK_DEPLOY_LAYER} ${stage} layer2 2`,
        options,
    )

    // ADD NEW MARKET YFI
    await asyncExec(`buidler --network ${layer2Network} ${TASK_DEPLOY_LAYER} ${stage} layer2 3`, options)
    await asyncExec(
        `buidler --network ${layer2Network} --config buidler.flatten.amm.config.ts ${TASK_DEPLOY_LAYER} ${stage} layer2 4`,
        options,
    )

    // ADD NEW MARKET DOT
    await asyncExec(`buidler --network ${layer2Network} ${TASK_DEPLOY_LAYER} ${stage} layer2 5`, options)

    // V2
    await asyncExec(`buidler --network ${layer1Network} ${TASK_DEPLOY_LAYER} ${stage} layer1 2`, options)
    await asyncExec(`buidler --network ${layer2Network} ${TASK_DEPLOY_LAYER} ${stage} layer2 6`, options)
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
