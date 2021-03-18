/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ChainlinkPriceFeed } from "../../types/ethers"
import { addAggregator } from "../contract/DeployUtil"
import { ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // deploy chainlink on layer 2
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy chainlink price feed on layer 2...")
            await context.factory
                .create<ChainlinkPriceFeed>(ContractFullyQualifiedName.ChainlinkPriceFeed)
                .deployUpgradableContract()
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "AAVE"
                const address = "0x2b481Dc923Aa050E009113Dca8dcb0daB4B68cDF"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "BTC"
                const address = "0x6C1d7e76EF7304a40e8456ce883BC56d3dEA3F7d"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "DOT"
                const address = "0x3c30c5c415B2410326297F0f65f5Cbb32f3aefCc"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "ETH"
                const address = "0xa767f745331D267c7751297D982b050c93985627"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "LINK"
                const address = "0xed322A5ac55BAE091190dFf9066760b86751947B"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "SUSHI"
                const address = "0xC0a6Bf8d5D408B091D022C3C0653d4056D4B9c01"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            if (context.stage !== "test") {
                const priceFeedKey = "YFI"
                const address = "0x14030d5a0C9e63D9606C6f2c8771Fc95b34b07e0"
                await addAggregator(priceFeedKey, address, context.factory, context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(
                `transferring chainlinkPriceFeed's owner to governance=${gov}...please remember to claim the ownership`,
            )
            const chainlinkPriceFeed = await context.factory
                .create<ChainlinkPriceFeed>(ContractFullyQualifiedName.ChainlinkPriceFeed)
                .instance()
            await (await chainlinkPriceFeed.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
    ],
}

export default migration
