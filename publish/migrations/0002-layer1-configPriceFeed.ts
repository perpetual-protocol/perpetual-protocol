/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from "ethers"
import { Layer } from "../../scripts/common"
import { ChainlinkL1, RootBridge } from "../../types/ethers"
import { PriceFeedKey } from "../contract/DeployConfig"
import { ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"
import { OzContractDeployer } from "../OzContractDeployer"

const migration: MigrationDefinition = {
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy chainlink price feed on layer 1...")
            const l2PriceFeedOnXdai = context.systemMetadataDao.getContractMetadata(
                Layer.Layer2,
                ContractName.L2PriceFeed,
            ).address
            const rootBridgeContract = context.factory.create<RootBridge>(ContractName.RootBridge)
            await context.factory
                .create<ChainlinkL1>(ContractName.ChainlinkL1)
                .deployUpgradableContract(rootBridgeContract.address!, l2PriceFeedOnXdai)
        },
        async (): Promise<void> => {
            console.log("setPriceFeed...")
            const chainlinkContract = context.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
            const rootBridge = await context.factory.create<RootBridge>(ContractName.RootBridge).instance()
            await (await rootBridge.setPriceFeed(chainlinkContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("add BTC aggregator of chainlink price feed on layer 1...")
            const chainlinkContract = context.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
            const chainlink = await chainlinkContract.instance()
            const address = context.deployConfig.chainlinkMap[PriceFeedKey.BTC]
            await (
                await chainlink.addAggregator(ethers.utils.formatBytes32String(PriceFeedKey.BTC.toString()), address)
            ).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("add ETH aggregator of chainlink price feed on layer 1...")
            const chainlinkContract = context.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
            const chainlink = await chainlinkContract.instance()
            const address = context.deployConfig.chainlinkMap[PriceFeedKey.ETH]
            await (
                await chainlink.addAggregator(ethers.utils.formatBytes32String(PriceFeedKey.ETH.toString()), address)
            ).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring chainlinkL1's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const chainlinkL1 = await context.factory.create<ChainlinkL1>(ContractName.ChainlinkL1).instance()
            await (await chainlinkL1.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring rootBridge's owner to governance=${gov}...please remember to claim the ownership`)
            const rootBridge = await context.factory.create<RootBridge>(ContractName.RootBridge).instance()
            await (await rootBridge.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            if (context.settingsDao.inSameLayer()) {
                return
            }
            const governance = context.externalContract.foundationGovernance!
            console.log(`transfer proxy admin to ${governance}`)
            await OzContractDeployer.transferProxyAdminOwnership(governance)
            console.log(`contract deployment finished.`)
        },
    ],
}

export default migration
