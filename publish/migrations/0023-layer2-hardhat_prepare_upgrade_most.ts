/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ChainlinkPriceFeed, ClientBridge, InsuranceFund, L2PriceFeed, MetaTxGateway } from "../../types/ethers"
import { ContractWrapper } from "../contract/ContractWrapper"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => {
        const emptyAddr = "0x0000000000000000000000000000000000000001"
        return [
            // L2PriceFeed
            async (): Promise<void> => {
                console.log("deploy implementation of L2PriceFeed...")

                const proxyContract: ContractWrapper<L2PriceFeed> = await context.factory.create<L2PriceFeed>(
                    ContractFullyQualifiedName.L2PriceFeed,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, emptyAddr)
            },
            // ClientBridge
            async (): Promise<void> => {
                console.log("deploy implementation of ClientBridge...")

                const proxyContract: ContractWrapper<ClientBridge> = await context.factory.create<ClientBridge>(
                    ContractFullyQualifiedName.ClientBridge,
                )
                await proxyContract.prepareUpgradeContract(emptyAddr, emptyAddr, emptyAddr)
            },

            // MetaTxGateway
            async (): Promise<void> => {
                console.log("deploy implementation of MetaTxGateway...")

                const proxyContract: ContractWrapper<MetaTxGateway> = await context.factory.create<MetaTxGateway>(
                    ContractFullyQualifiedName.MetaTxGateway,
                )
                await proxyContract.prepareUpgradeContract("", "", 0)
            },

            // ChainlinkPriceFeed
            async (): Promise<void> => {
                console.log("deploy implementation of ChainlinkPriceFeed...")

                const proxyContract: ContractWrapper<ChainlinkPriceFeed> = await context.factory.create<
                    ChainlinkPriceFeed
                >(ContractFullyQualifiedName.ChainlinkPriceFeed)
                await proxyContract.prepareUpgradeContract()
            },

            // InsuranceFund
            async (): Promise<void> => {
                console.log("deploy implementation of InsuranceFund...")

                const proxyContract: ContractWrapper<InsuranceFund> = await context.factory.create<InsuranceFund>(
                    ContractFullyQualifiedName.InsuranceFund,
                )
                await proxyContract.prepareUpgradeContract()
            },
        ]
    },
}

export default migration
