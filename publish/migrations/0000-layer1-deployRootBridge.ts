/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { RootBridge } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy root bridge")
            await context.factory
                .create<RootBridge>(ContractFullyQualifiedName.RootBridge)
                .deployUpgradableContract(
                    context.externalContract.ambBridgeOnEth!,
                    context.externalContract.multiTokenMediatorOnEth!,
                )
        },
    ],
}

export default migration
