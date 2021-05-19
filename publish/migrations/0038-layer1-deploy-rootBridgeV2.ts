/* eslint-disable @typescript-eslint/no-non-null-assertion */

//
// This is for gas-free deposit
// 1. deploy RootBridgeV2(inherit from ClientBridge) and MetaTxGateway on L1
//

import { formatEther } from "@ethersproject/units"
import { Layer } from "../../scripts/common"
import { MetaTxGateway, RootBridgeV2 } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy metaTxGateway...")
            const chainId = context.settingsDao.getChainId(Layer.Layer2)
            await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .deployUpgradableContract("Perp", "1", chainId)
        },

        async (): Promise<void> => {
            console.log("deploy rootBridgeV2...")
            const ambBridgeOnEth = context.externalContract.ambBridgeOnEth!
            const multiTokenMediatorOnEth = context.externalContract.multiTokenMediatorOnEth!
            const metaTxGatewayContract = context.factory.create<MetaTxGateway>(
                ContractFullyQualifiedName.MetaTxGateway,
            )
            await context.factory
                .create<RootBridgeV2>(ContractFullyQualifiedName.RootBridgeV2)
                .deployUpgradableContract(ambBridgeOnEth, multiTokenMediatorOnEth, metaTxGatewayContract.address!)
        },

        async (): Promise<void> => {
            console.log("rootBridgeV2 set min deposit amount...")
            const rootBridgeV2 = await context.factory
                .create<RootBridgeV2>(ContractFullyQualifiedName.RootBridgeV2)
                .instance()
            const USDC = context.externalContract.usdc!
            await (
                await rootBridgeV2.setMinDepositAmount(USDC, {
                    d: context.deployConfig.minDepositAmount,
                })
            ).wait(context.deployConfig.confirmations)

            const minAmount = await rootBridgeV2.minWithdrawalAmountMap(USDC)
            console.log(" - min deposit amount is ", formatEther(minAmount))
        },

        async (): Promise<void> => {
            console.log("metaTxGateway add rootBridgeV2 to whitelist...")
            const metaTxGateway = await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .instance()
            const clientBridgeContract = context.factory.create<RootBridgeV2>(ContractFullyQualifiedName.RootBridgeV2)
            await (await metaTxGateway.addToWhitelists(clientBridgeContract.address!)).wait(
                context.deployConfig.confirmations,
            )
        },

        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring rootBridgeV2's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const rootBridgeV2 = await context.factory
                .create<RootBridgeV2>(ContractFullyQualifiedName.RootBridgeV2)
                .instance()
            await (await rootBridgeV2.setOwner(gov)).wait(context.deployConfig.confirmations)
        },

        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring metaTxGateway's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const metaTxGateway = await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .instance()

            await (await metaTxGateway.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
    ],
}

export default migration
