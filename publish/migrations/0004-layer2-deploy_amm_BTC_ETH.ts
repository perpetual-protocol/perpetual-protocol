/* eslint-disable @typescript-eslint/no-non-null-assertion */

import bre from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { LEGACY_SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    // deploy a new implementation of Amm, in order to make xdai blockscout verification works,
    // we'll deploy a flatten one in an isolated build env. then PROXY_ADMIN should upgrade proxy to the new implementation
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.AmmV1}.sol`
            const toFilename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(LEGACY_SRC_DIR, bre.config.paths.sources, filename, toFilename)
            await bre.run(TASK_COMPILE)

            // deploy amm implementation
            const ETHUSDC = context.factory.createAmm(AmmInstanceName.ETHUSDC)
            await ETHUSDC.prepareUpgradeContract()

            const BTCUSDC = context.factory.createAmm(AmmInstanceName.BTCUSDC)
            await BTCUSDC.prepareUpgradeContract()
        },
    ],
}

export default migration
