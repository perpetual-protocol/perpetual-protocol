import bre, { ethers } from "@nomiclabs/buidler"
import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { ExternalContracts } from "../../scripts/common"
import { flatten } from "../../scripts/flatten"
import { ChainlinkPriceFeed, ClearingHouse, L2PriceFeed } from "../../types/ethers"
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
    needFlatten = false,
): DeployTask[] {
    return [
        async (): Promise<void> => {
            console.log(`deploy ${ammConfig.name} amm...`)
            const filename = `${ContractName.Amm}.sol`
            const l2PriceFeedContract = factory.create<L2PriceFeed>(ContractName.L2PriceFeed)

            if (needFlatten) {
                // after flatten sol file we must re-compile again
                await flatten(SRC_DIR, bre.config.paths.sources, filename)
                await bre.run(TASK_COMPILE)
            }

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

export async function addAggregator(
    priceFeedKey: string,
    address: string,
    factory: ContractWrapperFactory,
    confirmations: number,
): Promise<void> {
    const chainlinkPriceFeed = await factory.create<ChainlinkPriceFeed>(ContractName.ChainlinkPriceFeed).instance()
    let tx = await chainlinkPriceFeed.addAggregator(ethers.utils.formatBytes32String(priceFeedKey), address)
    await tx.wait(confirmations)
}
