/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { ChainlinkPriceFeed } from "../../types/ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const ammConfig = makeAmmConfig(
    AmmInstanceName.MKRUSDC,
    "MKR",
    // get this value from Asana, Daniel will calculate this value as x
    BigNumber.from(1_700).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(20),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        const priceFeedContract = context.factory.create<ChainlinkPriceFeed>(
            ContractFullyQualifiedName.ChainlinkPriceFeed,
        )

        return makeAmmDeployMigrationTasks(context, ammConfig, priceFeedContract.address!, true)
    },
}

export default migration
