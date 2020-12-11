/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExecOptions } from "child_process"
import { rm } from "shelljs"
import { SettingsDao } from "../publish/SettingsDao"
import { ozNetworkFile, Stage, TASK_DEPLOY_LAYER } from "./common"
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

    // remove .openzeppelin/${network}.json for the initial deploy
    if (0 === settings.getVersion("layer1")) {
        rm(`.openzeppelin/${ozNetworkFile[layer1Network]}.json`)
    }
    if (0 === settings.getVersion("layer2")) {
        rm(`.openzeppelin/${ozNetworkFile[layer2Network]}.json`)
    }

    // we have to break deployment up into multiple batches because:
    // (1) layer1 and layer2 contracts have circular dependencies
    // (2) buidler only works with one network at a time
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
