/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { LEGACY_SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    // batch 4
    // prepareUpgrade the flatten YFI AMM
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.AmmV1}.sol`
            const toFilename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(LEGACY_SRC_DIR, hre.config.paths.sources, filename, toFilename)
            await hre.run(TASK_COMPILE)

            // deploy amm implementation
            const YFIUSDC = context.factory.createAmm(AmmInstanceName.YFIUSDC, ContractFullyQualifiedName.FlattenAmm)
            await YFIUSDC.prepareUpgradeContract()
        },
    ],
}

export default migration
