/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ClearingHouse, L2PriceFeed } from "../../types/ethers"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // batch 5
    // deploy the fourth amm instance for new market
    // set cap, counterParty, set open...etc
    // transfer owner
    // transfer proxyAdmin
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy DOTUSDC amm...")
            const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
            const ammName = AmmInstanceName.DOTUSDC
            const ammContract = context.factory.createAmm(ammName)
            const quoteTokenAddr = context.externalContract.usdc!
            await ammContract.deployUpgradableContract(
                context.deployConfig.legacyAmmConfigMap[ammName].deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log("set DOT amm Cap...")
            const amm = await context.factory.createAmm(AmmInstanceName.DOTUSDC).instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = context.deployConfig.legacyAmmConfigMap[
                AmmInstanceName.DOTUSDC
            ].properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("DOT amm.setCounterParty...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(ContractName.ClearingHouse)
            const amm = await context.factory.createAmm(AmmInstanceName.DOTUSDC).instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("opening Amm DOTUSDC...")
            const DOTUSDC = await context.factory.createAmm(AmmInstanceName.DOTUSDC).instance()
            await (await DOTUSDC.setOpen(true)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring DOTUSDC owner to governance=${gov}...please remember to claim the ownership`)
            const DOTUSDC = await context.factory.createAmm(AmmInstanceName.DOTUSDC).instance()
            await (await DOTUSDC.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
    ],
}

export default migration
