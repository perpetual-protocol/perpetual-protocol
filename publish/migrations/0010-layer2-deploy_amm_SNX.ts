/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ClearingHouse, L2PriceFeed } from "../../types/ethers"
import { AmmInstanceName, ContractFullyQualifiedName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // batch 8
    // deploy the new amm instance for new market
    // set cap, counterParty, set open...etc
    // transfer owner
    // transfer proxyAdmin
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy SNXUSDC amm...")
            const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractFullyQualifiedName.L2PriceFeed)
            const ammContract = context.factory.createAmm(AmmInstanceName.SNXUSDC, ContractFullyQualifiedName.AmmV1)
            const quoteTokenAddr = context.externalContract.usdc!
            await ammContract.deployUpgradableContract(
                context.deployConfig.legacyAmmConfigMap[AmmInstanceName.SDEFIUSDC].deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log("set SNX amm Cap...")
            const amm = await context.factory
                .createAmm(AmmInstanceName.SNXUSDC, ContractFullyQualifiedName.AmmV1)
                .instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = context.deployConfig.legacyAmmConfigMap[
                AmmInstanceName.SNXUSDC
            ].properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("SNX amm.setCounterParty...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(
                ContractFullyQualifiedName.ClearingHouse,
            )
            const amm = await context.factory
                .createAmm(AmmInstanceName.SNXUSDC, ContractFullyQualifiedName.AmmV1)
                .instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("opening Amm SNXUSDC...")
            const SNXUSDC = await context.factory
                .createAmm(AmmInstanceName.SNXUSDC, ContractFullyQualifiedName.AmmV1)
                .instance()
            await (await SNXUSDC.setOpen(true)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring SNXUSDC owner to governance=${gov}...please remember to claim the ownership`)
            const SNXUSDC = await context.factory
                .createAmm(AmmInstanceName.SNXUSDC, ContractFullyQualifiedName.AmmV1)
                .instance()
            await (await SNXUSDC.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
    ],
}

export default migration
