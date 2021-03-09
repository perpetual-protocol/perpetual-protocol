/* eslint-disable @typescript-eslint/no-non-null-assertion */

import bre, { ethers } from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse, InsuranceFund, MetaTxGateway } from "../../types/ethers"
import { ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.clearinghouse.config.ts",

    // batch 7
    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.ClearingHouse}.sol`

            // after flatten sol file we must re-compile again
            await flatten(SRC_DIR, bre.config.paths.sources, filename)
            await bre.run(TASK_COMPILE)

            // deploy clearing house implementation
            const clearingHouseContract = await context.factory.create<ClearingHouse>(ContractName.ClearingHouse)
            const implContractAddr = await clearingHouseContract.prepareUpgradeContract()

            // in normal case we don't need to do anything to the implementation contract
            const insuranceFundContract = context.factory.create<InsuranceFund>(ContractName.InsuranceFund)
            const metaTxGatewayContract = context.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
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
