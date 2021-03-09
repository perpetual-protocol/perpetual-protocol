/* eslint-disable @typescript-eslint/no-non-null-assertion */

import bre from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { LEGACY_SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    // batch 4
    // prepareUpgrade the flatten YFI AMM
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.AmmV1}.sol`
            const toFilename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(LEGACY_SRC_DIR, bre.config.paths.sources, filename, toFilename)
            await bre.run(TASK_COMPILE)

            // deploy amm implementation
            const YFIUSDC = context.factory.createAmm(AmmInstanceName.YFIUSDC)
            await YFIUSDC.prepareUpgradeContract()
        },
    ],
}

export default migration
