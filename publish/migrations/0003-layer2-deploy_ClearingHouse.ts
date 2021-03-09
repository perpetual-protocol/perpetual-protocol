/* eslint-disable @typescript-eslint/no-non-null-assertion */

import bre from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse } from "../../types/ethers"
import { ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.clearinghouse.config.ts",

    // deploy a new implementation of ClearingHouse, in order to make xdai blockscout verification works,
    // we'll deploy a flatten one in an isolated build env. then PROXY_ADMIN should upgrade proxy to the new implementation
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.ClearingHouse}.sol`

            // after flatten sol file we must re-compile again
            await flatten(SRC_DIR, bre.config.paths.sources, filename)
            await bre.run(TASK_COMPILE)

            // deploy clearing house implementation
            const contract = context.factory.create<ClearingHouse>(ContractName.ClearingHouse)
            await contract.prepareUpgradeContract()
        },
    ],
}

export default migration
