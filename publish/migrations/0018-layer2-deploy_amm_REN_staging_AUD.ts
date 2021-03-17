/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { L2PriceFeed } from "../../types/ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const prodAmmConfig = makeAmmConfig(
    AmmInstanceName.RENUSDC,
    "REN",
    BigNumber.from(7_500_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(9300),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const stagAmmConfig = makeAmmConfig(
    AmmInstanceName.AUDUSDC,
    "AUD",
    BigNumber.from(7_500_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(9300),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        // change to ChainlinkPriceFeed if chainlink deploy price feed on xdai!
        const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
        const priceFeedAddress = l2PriceFeedContract.address!

        if (context.stage === "production") {
            return makeAmmDeployMigrationTasks(context, prodAmmConfig, priceFeedAddress, true)
        } else {
            return makeAmmDeployMigrationTasks(context, stagAmmConfig, priceFeedAddress, true)
        }
    },
}

export default migration
