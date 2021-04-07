/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers, upgrades } from "hardhat"
import { ChainlinkPriceFeed, ClientBridge, L2PriceFeed, MetaTxGateway } from "../../types/ethers"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        // L2PriceFeed
        async (): Promise<void> => {
            console.log("deploy implementation of L2PriceFeed...")

            const proxyContract = await context.factory
                .create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
                .instance()
            const newImplContractAddr = proxyContract.prepareUpgradeContract()

            // for staging
            const govSigner = ethers.provider.getSigner(context.externalContract.foundationGovernance)
            const proxyAdmin = await upgrades.admin.getInstance()
            await proxyAdmin.connect(govSigner).upgrade(proxyContract.address, newImplContractAddr)
        },
        // ClientBridge
        async (): Promise<void> => {
            console.log("deploy implementation of ClientBridge...")

            const proxyContract = await context.factory
                .create<ClientBridge>(ContractFullyQualifiedName.ClientBridge)
                .instance()
            const newImplContractAddr = proxyContract.prepareUpgradeContract()

            // for staging
            const govSigner = ethers.provider.getSigner(context.externalContract.foundationGovernance)
            const proxyAdmin = await upgrades.admin.getInstance()
            await proxyAdmin.connect(govSigner).upgrade(proxyContract.address, newImplContractAddr)
        },

        // MetaTxGateway
        async (): Promise<void> => {
            console.log("deploy implementation of MetaTxGateway...")

            const proxyContract = await context.factory
                .create<MetaTxGateway>(ContractFullyQualifiedName.MetaTxGateway)
                .instance()
            const newImplContractAddr = proxyContract.prepareUpgradeContract()

            // for staging
            const govSigner = ethers.provider.getSigner(context.externalContract.foundationGovernance)
            const proxyAdmin = await upgrades.admin.getInstance()
            await proxyAdmin.connect(govSigner).upgrade(proxyContract.address, newImplContractAddr)
        },

        // ChainlinkPriceFeed
        async (): Promise<void> => {
            console.log("deploy implementation of ChainlinkPriceFeed...")

            const proxyContract = await context.factory
                .create<ChainlinkPriceFeed>(ContractFullyQualifiedName.ChainlinkPriceFeed)
                .instance()
            const newImplContractAddr = proxyContract.prepareUpgradeContract()

            // for staging
            const govSigner = ethers.provider.getSigner(context.externalContract.foundationGovernance)
            const proxyAdmin = await upgrades.admin.getInstance()
            await proxyAdmin.connect(govSigner).upgrade(proxyContract.address, newImplContractAddr)
        },
    ],
}

export default migration
