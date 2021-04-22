/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { LEGACY_SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    // deploy a new implementation of Amm, in order to make xdai blockscout verification works,
    // we'll deploy a flatten one in an isolated build env. then PROXY_ADMIN should upgrade proxy to the new implementation
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.AmmV1}.sol`
            const toFilename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(LEGACY_SRC_DIR, hre.config.paths.sources, filename, toFilename)
            await hre.run(TASK_COMPILE)

            // deploy amm implementation
            const ETHUSDC = context.factory.createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.FlattenAmm)
            await ETHUSDC.prepareUpgradeContractLegacy()

            const BTCUSDC = context.factory.createAmm(AmmInstanceName.BTCUSDC, ContractFullyQualifiedName.FlattenAmm)
            await BTCUSDC.prepareUpgradeContractLegacy()
        },
    ],
}

export default migration
