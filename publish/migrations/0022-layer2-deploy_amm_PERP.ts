/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { ChainlinkPriceFeed } from "../../types/ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const perpAmmConfig = makeAmmConfig(
    AmmInstanceName.PERPUSDC,
    "PERP",
    // get this value from Asana, Daniel will calculate this value as x
    BigNumber.from(1_100_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(15_000),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        const chainlinkPriceFeedContract = context.factory.create<ChainlinkPriceFeed>(
            ContractFullyQualifiedName.ChainlinkPriceFeed,
        )

        return makeAmmDeployMigrationTasks(context, perpAmmConfig, chainlinkPriceFeedContract.address!, true)
    },
}

export default migration
