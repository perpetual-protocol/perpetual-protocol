/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import { DEFAULT_DIGITS, makeAmmConfig } from "../contract/DeployConfig"
import { makeLegacyAmmDeployMigrationTasks } from "../contract/DeployUtil"
import { AmmInstanceName } from "../ContractName"
import { MigrationContext, MigrationDefinition, MigrationTask } from "../Migration"

const linkAmmConfig = makeAmmConfig(
    AmmInstanceName.LINKUSDC,
    "LINK",
    BigNumber.from(300_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(5000),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const trxAmmConfig = makeAmmConfig(
    AmmInstanceName.TRXUSDC,
    "TRX",
    BigNumber.from(300_000).mul(DEFAULT_DIGITS),
    DEFAULT_DIGITS.mul(5000),
    BigNumber.from(DEFAULT_DIGITS).mul(2_000_000),
)

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    getTasks: (context: MigrationContext): MigrationTask[] => {
        if (context.stage === "production") {
            return makeLegacyAmmDeployMigrationTasks(context, linkAmmConfig)
        } else {
            return makeLegacyAmmDeployMigrationTasks(context, trxAmmConfig)
        }
    },
}

export default migration
