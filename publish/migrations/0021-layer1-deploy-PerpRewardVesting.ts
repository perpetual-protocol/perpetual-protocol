/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { PerpRewardVesting } from "../../types/ethers"
import { ContractFullyQualifiedName, ContractInstanceName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy PerpRewardVesting with 182 days (half year) vesting...")
            await context.factory
                .create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpStakingRewardNoVesting,
                )
                .deployUpgradableContract(context.externalContract.perp!, 0)
        },
        async (): Promise<void> => {
            console.log("PerpRewardVesting.setOwner")
            const perpRewardVesting = await context.factory
                .create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpStakingRewardNoVesting,
                )
                .instance()
            const gov = context.externalContract.rewardGovernance!
            await perpRewardVesting.setOwner(gov!)
        },
    ],
}

export default migration
