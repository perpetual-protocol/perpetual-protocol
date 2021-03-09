/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ClearingHouse, L2PriceFeed } from "../../types/ethers"
import { AmmInstanceName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

const migration: MigrationDefinition = {
    // deploy the third amm instance for new market
    // set cap, counterParty, set open...etc
    // transfer owner
    // transfer proxyAdmin
    getTasks: (context: MigrationContext) => [
        async (): Promise<void> => {
            console.log("deploy YFIUSDC amm...")
            const l2PriceFeedContract = context.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
            const ammName = AmmInstanceName.YFIUSDC
            const ammContract = context.factory.createAmm(ammName)
            const quoteTokenAddr = context.externalContract.usdc!
            await ammContract.deployUpgradableContract(
                context.deployConfig.legacyAmmConfigMap[ammName].deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log("set YFI amm Cap...")
            const amm = await context.factory.createAmm(AmmInstanceName.YFIUSDC).instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = context.deployConfig.legacyAmmConfigMap[
                AmmInstanceName.YFIUSDC
            ].properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(context.deployConfig.confirmations)
            }
        },
        async (): Promise<void> => {
            console.log("YFI amm.setCounterParty...")
            const clearingHouseContract = context.factory.create<ClearingHouse>(ContractName.ClearingHouse)
            const amm = await context.factory.createAmm(AmmInstanceName.YFIUSDC).instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            console.log("opening Amm YFIUSDC...")
            const YFIUSDC = await context.factory.createAmm(AmmInstanceName.YFIUSDC).instance()
            await (await YFIUSDC.setOpen(true)).wait(context.deployConfig.confirmations)
        },
        async (): Promise<void> => {
            const gov = context.externalContract.foundationGovernance!
            console.log(`transferring YFIUSDC owner to governance=${gov}...please remember to claim the ownership`)
            const YFIUSDC = await context.factory.createAmm(AmmInstanceName.YFIUSDC).instance()
            await (await YFIUSDC.setOwner(gov)).wait(context.deployConfig.confirmations)
        },
    ],
}

export default migration
