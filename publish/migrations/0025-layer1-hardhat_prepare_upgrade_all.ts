/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
    ChainlinkL1,
    FeeRewardPoolL1,
    FeeTokenPoolDispatcherL1,
    PerpRewardVesting,
    RootBridge,
    StakedPerpToken,
} from "../../types/ethers"
import { ContractWrapper } from "../contract/ContractWrapper"
import { ContractFullyQualifiedName, ContractInstanceName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => {
        const emptyAddr = "0x0000000000000000000000000000000000000001"
        return [
            // RootBridge
            async (): Promise<void> => {
                console.log("deploy implementation of RootBridge...")

                const proxyContract: ContractWrapper<RootBridge> = context.factory.create<RootBridge>(
                    ContractFullyQualifiedName.RootBridge,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, emptyAddr)
            },
            // ChainlinkL1
            async (): Promise<void> => {
                console.log("deploy implementation of ChainlinkL1...")

                const proxyContract: ContractWrapper<ChainlinkL1> = context.factory.create<ChainlinkL1>(
                    ContractFullyQualifiedName.ChainlinkL1,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, emptyAddr)
            },

            // PerpRewardNoVesting
            async (): Promise<void> => {
                console.log("deploy implementation of PerpRewardNoVesting...")

                const proxyContract: ContractWrapper<PerpRewardVesting> = context.factory.create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpStakingRewardNoVesting,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, 0)
            },

            // PerpRewardTwentySixWeeksVesting
            async (): Promise<void> => {
                console.log("deploy implementation of PerpRewardTwentySixWeeksVesting...")

                const proxyContract: ContractWrapper<PerpRewardVesting> = context.factory.create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpRewardTwentySixWeeksVesting,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, 0)
            },
            // FeeTokenPoolDispatcherL1
            async (): Promise<void> => {
                console.log("deploy implementation of FeeTokenPoolDispatcherL1...")

                const proxyContract: ContractWrapper<FeeTokenPoolDispatcherL1> = context.factory.create<
                    FeeTokenPoolDispatcherL1
                >(ContractFullyQualifiedName.FeeTokenPoolDispatcherL1)
                await proxyContract.prepareUpgradeContract()
            },

            // StakedPerpToken
            async (): Promise<void> => {
                console.log("deploy implementation of StakedPerpToken...")

                const proxyContract: ContractWrapper<StakedPerpToken> = context.factory.create<StakedPerpToken>(
                    ContractFullyQualifiedName.StakedPerpToken,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, 0)
            },

            // FeeRewardPoolL1
            async (): Promise<void> => {
                console.log("deploy implementation of FeeRewardPoolL1...")

                const proxyContract: ContractWrapper<FeeRewardPoolL1> = context.factory.create<FeeRewardPoolL1>(
                    ContractFullyQualifiedName.FeeRewardPoolL1,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, emptyAddr, emptyAddr)
            },

            // PerpStakingRewardVesting
            async (): Promise<void> => {
                console.log("deploy implementation of PerpStakingRewardVesting...")

                const proxyContract: ContractWrapper<PerpRewardVesting> = context.factory.create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpStakingRewardVesting,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, 0)
            },

            async (): Promise<void> => {
                console.log("deploy implementation of PerpStakingRewardNoVesting...")

                const proxyContract: ContractWrapper<PerpRewardVesting> = context.factory.create<PerpRewardVesting>(
                    ContractFullyQualifiedName.PerpRewardVesting,
                    ContractInstanceName.PerpStakingRewardNoVesting,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, 0)
            },
        ]
    },
}

export default migration
