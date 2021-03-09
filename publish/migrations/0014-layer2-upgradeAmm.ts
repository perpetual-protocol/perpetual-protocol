/* eslint-disable @typescript-eslint/no-non-null-assertion */

import bre, { ethers } from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { BigNumber } from "ethers"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { Amm } from "../../types/ethers"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "buidler.flatten.amm.config.ts",

    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            const filename = `${ContractName.Amm}.sol`

            // after flatten sol file we must re-compile again
            await flatten(SRC_DIR, bre.config.paths.sources, filename)
            await bre.run(TASK_COMPILE)

            // deploy clearing house implementation
            // proxy does not use here, we just use createAmm to create an implementation
            const contract = context.factory.createAmm(AmmInstanceName.BTCUSDC)
            const impAddress = await contract.prepareUpgradeContract()
            const amm = (await ethers.getContractAt(ContractName.Amm, impAddress)) as Amm
            const wei = BigNumber.from(1)
            const emptyAddr = "0x0000000000000000000000000000000000000001"
            await amm.initialize(
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
