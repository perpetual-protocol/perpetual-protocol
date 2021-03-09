/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const sushiAmmConfig = makeAmmConfig(
    AmmInstanceName.SUSHIUSDC,
    "SUSHI",
    BigNumber.from(460_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(5_000),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        return makeAmmDeployMigrationTasks(context, sushiAmmConfig, true)
    },
}

export default migration
