import { ethers } from "@nomiclabs/buidler"
import { ExternalContracts } from "../../scripts/common"
import { ClearingHouse, L2PriceFeed } from "../../types/ethers"
import { ContractName } from "../ContractName"
import { ContractWrapperFactory } from "./ContractWrapperFactory"
import { AmmConfig } from "./DeployConfig"

export type DeployTask = () => Promise<void>

export async function getImplementation(proxyAdminAddr: string, proxyAddr: string) {
    const proxyAdminAbi = ["function getProxyImplementation(address proxy) view returns (address)"]
    const proxyAdmin = await ethers.getContractAt(proxyAdminAbi, proxyAdminAddr)
    return proxyAdmin.getProxyImplementation(proxyAddr)
}

export function makeAmmDeployBatch(
    ammConfig: AmmConfig,
    factory: ContractWrapperFactory,
    externalContract: ExternalContracts,
    confirmations: number,
): DeployTask[] {
    return [
        async (): Promise<void> => {
            console.log(`deploy ${ammConfig.name} amm...`)
            const l2PriceFeedContract = factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
            const ammContract = factory.createAmm(ammConfig.name)
            const quoteTokenAddr = externalContract.usdc!
            await ammContract.deployUpgradableContract(
                ammConfig.deployArgs,
                l2PriceFeedContract.address!,
                quoteTokenAddr,
            )
        },
        async (): Promise<void> => {
            console.log(`set ${ammConfig.name} amm Cap...`)
            const amm = await factory.createAmm(ammConfig.name).instance()
            const { maxHoldingBaseAsset, openInterestNotionalCap } = ammConfig.properties
            if (maxHoldingBaseAsset.gt(0)) {
                await (
                    await amm.setCap({ d: maxHoldingBaseAsset.toString() }, { d: openInterestNotionalCap.toString() })
                ).wait(confirmations)
            }
        },
        async (): Promise<void> => {
            console.log(`${ammConfig.name} amm.setCounterParty...`)
            const clearingHouseContract = factory.create<ClearingHouse>(ContractName.ClearingHouse)
            const amm = await factory.createAmm(ammConfig.name).instance()
            await (await amm.setCounterParty(clearingHouseContract.address!)).wait(confirmations)
        },
        async (): Promise<void> => {
            console.log(`opening Amm ${ammConfig.name}...`)
            const amm = await factory.createAmm(ammConfig.name).instance()
            await (await amm.setOpen(true)).wait(confirmations)
        },
        async (): Promise<void> => {
            const gov = externalContract.foundationGovernance!
            console.log(
                `transferring ${ammConfig.name} owner to governance=${gov}...please remember to claim the ownership`,
            )
            const amm = await factory.createAmm(ammConfig.name).instance()
            await (await amm.setOwner(gov)).wait(confirmations)
        },
    ]
}
