/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { PerpRewardVesting } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy PerpRewardVesting with 0 vesting...")
            await context.factory
                .create<PerpRewardVesting>(ContractFullyQualifiedName.PerpRewardVesting)
                .deployUpgradableContract(context.externalContract.perp!, 0)
        },
        async (): Promise<void> => {
            console.log("deploy PerpRewardVesting with 5 minutes vesting...")
            await context.factory
                .create<PerpRewardVesting>(ContractFullyQualifiedName.PerpRewardVesting)
                .deployUpgradableContract(context.externalContract.perp!, BigNumber.from(60 * 5))
        },
    ],
}

export default migration
