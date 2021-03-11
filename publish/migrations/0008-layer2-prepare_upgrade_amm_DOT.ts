/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "ethers"
import hre, { ethers } from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { LEGACY_SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { Amm } from "../../types/ethers"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.amm.config.ts",

    // batch 6
    // deploy the flattened amm for DOT (production), or LINK (staging)
    // cant prepare upgrade for other amm due to openzeppelin upgrade sdk issue
    // https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/175
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.AmmV1}.sol`
            const toFilename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(LEGACY_SRC_DIR, hre.config.paths.sources, filename, toFilename)
            await hre.run(TASK_COMPILE)

            // deploy amm implementation
            const DOTUSDC = context.factory.createAmm(AmmInstanceName.DOTUSDC, ContractFullyQualifiedName.FlattenAmm)
            const dotUsdcImplAddr = await DOTUSDC.prepareUpgradeContract()

            // in normal case we don't need to do anything to the implementation contract
            const ammImplInstance = (await ethers.getContractAt(ContractName.Amm, dotUsdcImplAddr)) as Amm
            const wei = BigNumber.from(1)
            const emptyAddr = "0x0000000000000000000000000000000000000001"
            await ammImplInstance.initialize(
                wei,
                wei,
                wei,
                wei,
                emptyAddr,
                ethers.utils.formatBytes32String(""),
                emptyAddr,
                wei,
                wei,
                wei,
            )
        },
    ],
}

export default migration
