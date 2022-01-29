/* eslint-disable @typescript-eslint/no-non-null-assertion */

//
// This is for adding a  minimum withdrawal limit when withdraw from L2 to L1
//

import { ClientBridge } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy ClientBridge...")
            const emptyAddr = "0x0000000000000000000000000000000000000001"
            await context.factory
                .create<ClientBridge>(ContractFullyQualifiedName.ClientBridge)
                .prepareUpgradeContract(emptyAddr, emptyAddr, emptyAddr)

            console.log("Please remember to set min withdrawal amount...")
        },
    ],
}

export default migration
