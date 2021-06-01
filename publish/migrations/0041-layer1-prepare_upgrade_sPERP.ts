/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { StakedPerpToken } from "../../types/ethers"
import { ContractWrapper } from "../contract/ContractWrapper"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // deploy the sPERP
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const emptyAddr = "0x0000000000000000000000000000000000000001"

            // deploy sPERP implementation
            const proxyContract: ContractWrapper<StakedPerpToken> = await context.factory.create<StakedPerpToken>(
                ContractFullyQualifiedName.StakedPerpToken,
            )
            await proxyContract.prepareUpgradeContract(emptyAddr, 0)
        },
    ],
}

export default migration
