/* eslint-disable @typescript-eslint/no-non-null-assertion */

import hre, { ethers } from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse, InsuranceFund, MetaTxGateway } from "../../types/ethers"
import { ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.clearinghouse.config.ts",

    // batch 7
    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.ClearingHouse}.sol`

            // after flatten sol file we must re-compile again
            await flatten(SRC_DIR, hre.config.paths.sources, filename)
            await hre.run(TASK_COMPILE)

            // deploy clearing house implementation
            const clearingHouseContract = await context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.FlattenClearingHouse,
            )
            const implContractAddr = await clearingHouseContract.prepareUpgradeContractLegacy()

            // in normal case we don't need to do anything to the implementation contract
            const insuranceFundContract = context.factory.create<InsuranceFund>(
                ContractFullyQualifiedName.FlattenInsuranceFund,
            )
            const metaTxGatewayContract = context.factory.create<MetaTxGateway>(
                ContractFullyQualifiedName.FlattenMetaTxGateway,
            )
            const clearingHouseImplInstance = (await ethers.getContractAt(
                ContractName.ClearingHouse,
                implContractAddr,
            )) as ClearingHouse
            await clearingHouseImplInstance.initialize(
                context.deployConfig.initMarginRequirement,
                context.deployConfig.maintenanceMarginRequirement,
                context.deployConfig.liquidationFeeRatio,
                insuranceFundContract.address!,
                metaTxGatewayContract.address!,
            )
        },
    ],
}

export default migration
