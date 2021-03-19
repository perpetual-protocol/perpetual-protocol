/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { FeeRewardPoolL1, FeeTokenPoolDispatcherL1, StakedPerpToken } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy feeTokenPoolDispatcherL1")
            await context.factory
                .create<FeeTokenPoolDispatcherL1>(ContractFullyQualifiedName.FeeTokenPoolDispatcherL1)
                .deployUpgradableContract()
        },
        async (): Promise<void> => {
            console.log("deploy StakedPerpToken")
            let cooldownPeriod: BigNumber
            if (context.stage === "production") {
                cooldownPeriod = BigNumber.from(60 * 60 * 24 * 7 * 2)
            } else {
                cooldownPeriod = BigNumber.from(60 * 5)
            }
            const perpAddr = context.settingsDao.getExternalContracts(context.layer).perp!
            await context.factory
                .create<StakedPerpToken>(ContractFullyQualifiedName.StakedPerpToken)
                .deployUpgradableContract(perpAddr, cooldownPeriod)
        },
        async (): Promise<void> => {
            console.log("deploy FeeRewardPoolL1")
            const usdc = context.settingsDao.getExternalContracts(context.layer).usdc!
            const stakedPerpToken = context.factory.create<StakedPerpToken>(ContractFullyQualifiedName.StakedPerpToken)
            const feeTokenPoolDispatcherL1 = context.factory.create<FeeTokenPoolDispatcherL1>(
                ContractFullyQualifiedName.FeeTokenPoolDispatcherL1,
            )
            await context.factory
                .create<FeeRewardPoolL1>(ContractFullyQualifiedName.FeeRewardPoolL1)
                .deployUpgradableContract(usdc, stakedPerpToken.address, feeTokenPoolDispatcherL1.address)
        },
        async (): Promise<void> => {
            console.log("feeTokenPoolDispatcherL1.addFeeRewardPool")
            const feeRewardPoolL1 = context.factory.create<FeeRewardPoolL1>(ContractFullyQualifiedName.FeeRewardPoolL1)
            const feeTokenPoolDispatcherL1 = await context.factory
                .create<FeeTokenPoolDispatcherL1>(ContractFullyQualifiedName.FeeTokenPoolDispatcherL1)
                .instance()
            await feeTokenPoolDispatcherL1.addFeeRewardPool(feeRewardPoolL1.address!)
        },
        async (): Promise<void> => {
            console.log("stakedPerpToken.addStakeModule")
            const stakedPerpToken = await context.factory
                .create<StakedPerpToken>(ContractFullyQualifiedName.StakedPerpToken)
                .instance()
            const feeRewardPoolL1 = context.factory.create<FeeRewardPoolL1>(ContractFullyQualifiedName.FeeRewardPoolL1)
            await stakedPerpToken.addStakeModule(feeRewardPoolL1.address!)
        },
        async (): Promise<void> => {
            console.log("stakedPerpToken.setOwner")
            const stakedPerpToken = await context.factory
                .create<StakedPerpToken>(ContractFullyQualifiedName.StakedPerpToken)
                .instance()
            const gov = context.externalContract.foundationGovernance!
            await stakedPerpToken.setOwner(gov!)
        },
        async (): Promise<void> => {
            console.log("feeRewardPoolL1.setOwner")
            const feeRewardPoolL1 = await context.factory
                .create<FeeRewardPoolL1>(ContractFullyQualifiedName.FeeRewardPoolL1)
                .instance()
            const gov = context.externalContract.foundationGovernance!
            await feeRewardPoolL1.setOwner(gov!)
        },
        async (): Promise<void> => {
            console.log("feeTokenPoolDispatcherL1.setOwner")
            const feeTokenPoolDispatcherL1 = await context.factory
                .create<FeeTokenPoolDispatcherL1>(ContractFullyQualifiedName.FeeTokenPoolDispatcherL1)
                .instance()
            const gov = context.externalContract.foundationGovernance!
            await feeTokenPoolDispatcherL1.setOwner(gov!)
        },
    ],
}

export default migration
