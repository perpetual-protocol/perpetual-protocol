/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { ChainlinkPriceFeed } from "../../types/ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    getTasks: (context: MigrationContext) => [
        // BTC/USD
        async (): Promise<void> => {
            console.log("deploy implementation of BTC/USD...")

            const chainlinkPriceFeedContract = context.factory.create<ChainlinkPriceFeed>(
                ContractFullyQualifiedName.ChainlinkPriceFeed,
            )

            const perpAmmConfig = makeAmmConfig(
                AmmInstanceName.BTCUSDC,
                "BTC",
                BigNumber.from(1_100_000).mul(DEFAULT_DIGITS),
                DEFAULT_DIGITS.mul(15_000),
                BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
            )

            makeAmmDeployMigrationTasks(context, perpAmmConfig, chainlinkPriceFeedContract.address!, true)
        },
    ],
}

export default migration
