/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { expect } from "chai"
import hre, { ethers } from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse, InsuranceFund, MetaTxGateway } from "../../types/ethers"
import { getImplementation } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.clearinghouse.config.ts",

    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => {
        let arbitrageur: string
        let initMarginRatio: string
        let oldImpAddr: string
        let insuranceFund: string
        let BTC: string
        let arbitrageurBTCPositionSize: string
        let openInterestNotional: string
        return [
            async (): Promise<void> => {
                console.log("verifying state variables...")

                // have to first flatten contracts for creating instances
                const filename = `${ContractName.ClearingHouse}.sol`
                await flatten(SRC_DIR, hre.config.paths.sources, filename)
                // after flatten sol file we must re-compile again
                await hre.run(TASK_COMPILE)

                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                oldImpAddr = await getImplementation(clearingHouseContract.address)
                initMarginRatio = (await clearingHouseContract.initMarginRatio()).toString()
                insuranceFund = await clearingHouseContract.insuranceFund()
                BTC = context.systemMetadataDao.getContractMetadata(context.layer, AmmInstanceName.BTCUSDC).address
                openInterestNotional = (await clearingHouseContract.openInterestNotionalMap(BTC)).toString()

                arbitrageur = context.externalContract.arbitrageur!
                arbitrageurBTCPositionSize = (
                    await clearingHouseContract.getUnadjustedPosition(BTC, arbitrageur)
                ).size.toString()
            },
            async (): Promise<void> => {
                // deploy clearing house implementation
                const clearingHouseContract = await context.factory.create<ClearingHouse>(
                    ContractFullyQualifiedName.FlattenClearingHouse,
                )
                const implContractAddr = await clearingHouseContract.prepareUpgradeContractLegacy()

                // in normal case we don't need to do anything to the implementation contract
                const insuranceFundContract = context.factory.create<InsuranceFund>(
                    ContractFullyQualifiedName.FlattenInsuranceFund,
                )
                const metaTxGatewayContract = context.factory.create<MetaTxGateway>(
                    ContractFullyQualifiedName.FlattenMetaTxGateway,
                )
                const clearingHouseImplInstance = (await ethers.getContractAt(
                    ContractName.ClearingHouse,
                    implContractAddr,
                )) as ClearingHouse
                await clearingHouseImplInstance.initialize(
                    context.deployConfig.initMarginRequirement,
                    context.deployConfig.maintenanceMarginRequirement,
                    context.deployConfig.liquidationFeeRatio,
                    insuranceFundContract.address!,
                    metaTxGatewayContract.address!,
                )
            },
            async (): Promise<void> => {
                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                // for comparing with the new implementation address
                console.log("old implementation address: ", oldImpAddr)

                const newInsuranceFund = await clearingHouseContract.insuranceFund()
                console.log("insuranceFund address (shouldn't be zero address): ", newInsuranceFund)
                expect(newInsuranceFund).to.eq(insuranceFund)
                console.log("insuranceFund verified!")

                expect((await clearingHouseContract.initMarginRatio()).toString()).to.eq(initMarginRatio)
                console.log("initMarginRatio verified!")
                expect((await clearingHouseContract.openInterestNotionalMap(BTC)).toString()).to.eq(
                    openInterestNotional,
                )
                console.log("openInterestNotional verified!")
                expect((await clearingHouseContract.getUnadjustedPosition(BTC, arbitrageur)).size.toString()).to.eq(
                    arbitrageurBTCPositionSize,
                )
                console.log("arbitrageurBTCPositionSize verified!")
            },
        ]
    },
}

export default migration
