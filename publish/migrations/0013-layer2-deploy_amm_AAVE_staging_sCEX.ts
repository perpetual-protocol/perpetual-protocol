/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeLegacyAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const aaveAmmConfig = makeAmmConfig(
    AmmInstanceName.AAVEUSDC,
    "AAVE",
    BigNumber.from(20_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(250),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const sCexAmmConfig = makeAmmConfig(
    AmmInstanceName.SCEXUSDC,
    "sCEX",
    BigNumber.from(12_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(250),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        if (context.stage === "production") {
            return makeLegacyAmmDeployMigrationTasks(context, aaveAmmConfig, true)
        } else {
            return makeLegacyAmmDeployMigrationTasks(context, sCexAmmConfig, true)
        }
    },
}

export default migration
