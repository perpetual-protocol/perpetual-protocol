/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    // deploy the flattened amm and init it just in case
    getTasks: (context: MigrationContext) => {
        return [
            // amm
            async (): Promise<void> => {
                console.log("deploy implementation of BTC/USD...")
                const filename = `${ContractName.Amm}.sol`

                // after flatten sol file we must re-compile again
                await flatten(SRC_DIR, hre.config.paths.sources, filename)
                await hre.run(TASK_COMPILE)

                // deploy amm implementation
                const BTCUSDC = context.factory.createAmm(
                    AmmInstanceName.BTCUSDC,
                    ContractFullyQualifiedName.FlattenAmm,
                )
                await BTCUSDC.prepareUpgradeContract()
            },
        ]
    },
}

export default migration
