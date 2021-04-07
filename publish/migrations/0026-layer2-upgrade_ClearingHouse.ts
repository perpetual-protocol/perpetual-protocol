/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse } from "../../types/ethers"
import { ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.clearinghouse.config.ts",

    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const emptyAddr = "0x0000000000000000000000000000000000000001"
            const filename = `${ContractName.ClearingHouse}.sol`

            // after flatten sol file we must re-compile again
            await flatten(SRC_DIR, hre.config.paths.sources, filename)
            await hre.run(TASK_COMPILE)

            // deploy clearing house implementation
            const clearingHouseContract = await context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.FlattenClearingHouse,
            )
            await clearingHouseContract.prepareUpgradeContract(
                context.deployConfig.initMarginRequirement,
                context.deployConfig.maintenanceMarginRequirement,
                context.deployConfig.liquidationFeeRatio,
                emptyAddr,
                emptyAddr,
            )
        },
    ],
}

export default migration
