/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ClearingHouse, ClearingHouseViewer } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {

            console.log("deploy clearingHouseViewer...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.ClearingHouse,
            )
            const clearingHouseViewerContract = context.factory.create<ClearingHouseViewer>(
                ContractFullyQualifiedName.ClearingHouseViewer,
            )
            await clearingHouseViewerContract.deployImmutableContract(clearingHouseContract.address!)
        },
    ],
}

export default migration
