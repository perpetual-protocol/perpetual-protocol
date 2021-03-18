/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { L2PriceFeed } from "../../types/ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const compAmmConfig = makeAmmConfig(
    AmmInstanceName.COMPUSDC,
    "COMP",
    BigNumber.from(17_600).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(200),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const xagAmmConfig = makeAmmConfig(
    AmmInstanceName.XAGUSDC,
    "XAG",
    BigNumber.from(17_600).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(200),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
        const priceFeedAddress = l2PriceFeedContract.address!

        if (context.stage === "production") {
            return makeAmmDeployMigrationTasks(context, compAmmConfig, priceFeedAddress, true)
        } else {
            return makeAmmDeployMigrationTasks(context, xagAmmConfig, priceFeedAddress, true)
        }
    },
}

export default migration
