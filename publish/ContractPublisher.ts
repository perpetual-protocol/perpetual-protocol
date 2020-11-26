/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { ExternalContracts, Layer } from "../scripts/common"
import {
    AmmReader,
    ChainlinkL1,
    ClearingHouse,
    ClearingHouseViewer,
    ClientBridge,
    InsuranceFund,
    L2PriceFeed,
    MetaTxGateway,
    RootBridge,
} from "../types/ethers"
import { ContractWrapperFactory } from "./contract/ContractWrapperFactory"
import { DeployConfig } from "./contract/DeployConfig"
import { AmmInstanceName, ContractName } from "./ContractName"
import { OzContractDeployer } from "./OzContractDeployer"
import { SettingsDao } from "./SettingsDao"
import { SystemMetadataDao } from "./SystemMetadataDao"

export type DeployTask = () => Promise<void>

/* eslint-disable no-console */
export class ContractPublisher {
    readonly externalContract: ExternalContracts
    readonly factory: ContractWrapperFactory
    readonly deployConfig: DeployConfig
    protected taskBatchesMap: Record<Layer, DeployTask[][]> = {
        layer1: [
            // batch 0
            [
                async (): Promise<void> => {
                    // deploy root bridge
                    await this.factory
                        .create<RootBridge>(ContractName.RootBridge)
                        .deployUpgradableContract(
                            this.externalContract.ambBridgeOnEth!,
                            this.externalContract.multiTokenMediatorOnEth!,
                        )
                },
            ],
            // batch 1
            [
                async (): Promise<void> => {
                    console.log("deploy chainlink price feed on layer 1...")
                    const l2PriceFeedOnXdai = this.systemMetadataDao.getContractMetadata(
                        "layer2",
                        ContractName.L2PriceFeed,
                    ).address
                    const rootBridgeContract = this.factory.create<RootBridge>(ContractName.RootBridge)
                    await this.factory
                        .create<ChainlinkL1>(ContractName.ChainlinkL1)
                        .deployUpgradableContract(rootBridgeContract.address!, l2PriceFeedOnXdai)
                },
                async (): Promise<void> => {
                    console.log("setPriceFeed...")
                    const chainlinkContract = this.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
                    const rootBridge = await this.factory.create<RootBridge>(ContractName.RootBridge).instance()
                    await (await rootBridge.setPriceFeed(chainlinkContract.address!)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    console.log("add aggregator of chainlink price feed on layer 1...")
                    const chainlinkContract = this.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
                    const chainlink = await chainlinkContract.instance()
                    for (const priceFeedKey in this.deployConfig.chainlinkMap) {
                        const address = this.deployConfig.chainlinkMap[priceFeedKey]
                        console.log(`addAggregator=${priceFeedKey.toString()}`)
                        await (
                            await chainlink.addAggregator(
                                ethers.utils.formatBytes32String(priceFeedKey.toString()),
                                address,
                            )
                        ).wait(this.confirmations)
                    }
                },
                async (): Promise<void> => {
                    const gov = this.externalContract.foundationGovernance!
                    console.log(`transferring owner to governance=${gov}...please remember to claim the ownership`)

                    const chainlinkL1 = await this.factory.create<ChainlinkL1>(ContractName.ChainlinkL1).instance()
                    const rootBridge = await this.factory.create<RootBridge>(ContractName.RootBridge).instance()
                    await (await chainlinkL1.setOwner(gov)).wait(this.confirmations)
                    await (await rootBridge.setOwner(gov)).wait(this.confirmations)
                },
            ],
        ],
        layer2: [
            // batch 0
            [
                async (): Promise<void> => {
                    // deploy meta tx gateway
                    const chainId = this.settingsDao.getChainId("layer1")
                    await this.factory
                        .create<MetaTxGateway>(ContractName.MetaTxGateway)
                        .deployUpgradableContract("Perp", "1", chainId)
                },
                async (): Promise<void> => {
                    // deploy client bridge
                    const ambBridgeOnXDai = this.externalContract.ambBridgeOnXDai!
                    const multiTokenMediatorOnXDai = this.externalContract.multiTokenMediatorOnXDai!
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    await this.factory
                        .create<ClientBridge>(ContractName.ClientBridge)
                        .deployUpgradableContract(
                            ambBridgeOnXDai,
                            multiTokenMediatorOnXDai,
                            metaTxGatewayContract.address!,
                        )
                },
                async (): Promise<void> => {
                    // deploy insurance fund
                    await this.factory.create<InsuranceFund>(ContractName.InsuranceFund).deployUpgradableContract()
                },
                async (): Promise<void> => {
                    // deploy L2 price feed
                    const ambBridgeOnXDaiAddr = this.externalContract.ambBridgeOnXDai!
                    const rootBridgeOnEthAddr = this.systemMetadataDao.getContractMetadata(
                        "layer1",
                        ContractName.RootBridge,
                    ).address
                    await this.factory
                        .create<L2PriceFeed>(ContractName.L2PriceFeed)
                        .deployUpgradableContract(ambBridgeOnXDaiAddr, rootBridgeOnEthAddr)
                },
                async (): Promise<void> => {
                    // deploy clearing house
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    await this.factory
                        .create<ClearingHouse>(ContractName.ClearingHouse)
                        .deployUpgradableContract(
                            this.deployConfig.initMarginRequirement,
                            this.deployConfig.maintenanceMarginRequirement,
                            this.deployConfig.liquidationFeeRatio,
                            insuranceFundContract.address!,
                            metaTxGatewayContract.address!,
                        )
                },
                async (): Promise<void> => {
                    const clearingHouse = await this.factory
                        .create<ClearingHouse>(ContractName.ClearingHouse)
                        .instance()
                    const metaTxGateway = await this.factory
                        .create<MetaTxGateway>(ContractName.MetaTxGateway)
                        .instance()
                    const insuranceFund = await this.factory
                        .create<InsuranceFund>(ContractName.InsuranceFund)
                        .instance()

                    console.log("metaTxGateway.addToWhitelists...")
                    await (await metaTxGateway.addToWhitelists(clearingHouse.address)).wait(this.confirmations)
                    console.log("insuranceFundContract.setBeneficiary...")
                    await (await insuranceFund.setBeneficiary(clearingHouse.address)).wait(this.confirmations)
                    console.log("clearingHouse.setWhitelist...")
                    await (
                        await clearingHouse.setWhitelist(this.settingsDao.getExternalContracts("layer2").arbitrageur!)
                    ).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // deploy amm
                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    const ammContract = this.factory.createAmm(AmmInstanceName.ETHUSDC)
                    const quoteTokenAddr = this.externalContract.usdc!
                    await ammContract.deployUpgradableContract(
                        this.deployConfig.ammConfigMap,
                        l2PriceFeedContract.address!,
                        quoteTokenAddr,
                    )
                },
                async (): Promise<void> => {
                    // deploy amm
                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    const ammContract = this.factory.createAmm(AmmInstanceName.BTCUSDC)
                    const quoteTokenAddr = this.externalContract.usdc!
                    await ammContract.deployUpgradableContract(
                        this.deployConfig.ammConfigMap,
                        l2PriceFeedContract.address!,
                        quoteTokenAddr,
                    )
                },
                async (): Promise<void> => {
                    //  deploy clearingHouseViewer
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)
                    const clearingHouseViewerContract = this.factory.create<ClearingHouseViewer>(
                        ContractName.ClearingHouseViewer,
                    )
                    await clearingHouseViewerContract.deployImmutableContract(clearingHouseContract.address!)
                },
                async (): Promise<void> => {
                    //  deploy ammReader
                    const ammReaderContract = this.factory.create<AmmReader>(ContractName.AmmReader)
                    await ammReaderContract.deployImmutableContract()
                },
                async (): Promise<void> => {
                    console.log("metaTxGateway.addToWhitelists(clientBridge.address)...")
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    const metaTxGateway = await metaTxGatewayContract.instance()
                    const clientBridgeContract = this.factory.create<ClientBridge>(ContractName.ClientBridge)
                    await (await metaTxGateway.addToWhitelists(clientBridgeContract.address!)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    console.log("add aggregators to L2PriceFeed")
                    const l2PriceFeed = await this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed).instance()
                    for (const priceFeedKey in this.deployConfig.chainlinkMap) {
                        console.log(`add aggregator=${priceFeedKey}`)
                        await (
                            await l2PriceFeed.addAggregator(ethers.utils.formatBytes32String(priceFeedKey.toString()))
                        ).wait(this.confirmations)
                    }
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm ETHUSDC...")
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)
                    const ammContract = this.factory.createAmm(AmmInstanceName.ETHUSDC)
                    const amm = await ammContract.instance()
                    const insuranceFund = await insuranceFundContract.instance()
                    const { maxHoldingBaseAsset, openInterestNotionalCap } = this.deployConfig.ammConfigMap[
                        AmmInstanceName.ETHUSDC
                    ].properties

                    if (maxHoldingBaseAsset.gt(0)) {
                        console.log("setCap...")
                        await (
                            await amm.setCap(
                                { d: maxHoldingBaseAsset.toString() },
                                { d: openInterestNotionalCap.toString() },
                            )
                        ).wait(this.confirmations)
                    }
                    console.log("amm.setCounterParty...")
                    await (await amm.setCounterParty(clearingHouseContract.address!)).wait(this.confirmations)
                    console.log("insuranceFund.addAmm...")
                    await (await insuranceFund.addAmm(amm.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm BTCUSDC...")
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)
                    const ammContract = this.factory.createAmm(AmmInstanceName.BTCUSDC)
                    const amm = await ammContract.instance()
                    const insuranceFund = await insuranceFundContract.instance()
                    const { maxHoldingBaseAsset, openInterestNotionalCap } = this.deployConfig.ammConfigMap[
                        AmmInstanceName.BTCUSDC
                    ].properties

                    if (maxHoldingBaseAsset.gt(0)) {
                        console.log("setCap...")
                        await (
                            await amm.setCap(
                                { d: maxHoldingBaseAsset.toString() },
                                { d: openInterestNotionalCap.toString() },
                            )
                        ).wait(this.confirmations)
                    }
                    console.log("amm.setCounterParty...")
                    await (await amm.setCounterParty(clearingHouseContract.address!)).wait(this.confirmations)
                    console.log("insuranceFund.addAmm...")
                    await (await insuranceFund.addAmm(amm.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // open amm
                    console.log("opening Amm ETHUSDC...")
                    const ethUsdc = await this.factory.createAmm(AmmInstanceName.ETHUSDC).instance()
                    await (await ethUsdc.setOpen(true)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // open amm
                    console.log("opening Amm BTCUSDC...")
                    const btcUsdc = await this.factory.createAmm(AmmInstanceName.BTCUSDC).instance()
                    await (await btcUsdc.setOpen(true)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    const l2PriceFeed = await this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed).instance()
                    await (
                        await l2PriceFeed!.setRootBridge(
                            this.systemMetadataDao.getContractMetadata("layer1", ContractName.RootBridge).address,
                        )
                    ).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    const gov = this.externalContract.foundationGovernance!
                    console.log(`transferring owner to governance=${gov}...please remember to claim the ownership`)

                    const metaTxGateway = await this.factory
                        .create<MetaTxGateway>(ContractName.MetaTxGateway)
                        .instance()
                    const clientBridge = await this.factory.create<ClientBridge>(ContractName.ClientBridge).instance()
                    const insuranceFund = await this.factory
                        .create<InsuranceFund>(ContractName.InsuranceFund)
                        .instance()
                    const l2PriceFeed = await this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed).instance()
                    const clearingHouse = await this.factory
                        .create<ClearingHouse>(ContractName.ClearingHouse)
                        .instance()
                    const ETHUSDC = await this.factory.createAmm(AmmInstanceName.ETHUSDC).instance()
                    const BTCUSDC = await this.factory.createAmm(AmmInstanceName.BTCUSDC).instance()

                    await (await metaTxGateway.setOwner(gov)).wait(this.confirmations)
                    await (await clientBridge.setOwner(gov)).wait(this.confirmations)
                    await (await insuranceFund.setOwner(gov)).wait(this.confirmations)
                    await (await l2PriceFeed.setOwner(gov)).wait(this.confirmations)
                    await (await clearingHouse.setOwner(gov)).wait(this.confirmations)
                    await (await ETHUSDC.setOwner(gov)).wait(this.confirmations)
                    await (await BTCUSDC.setOwner(gov)).wait(this.confirmations)
                },
            ],
        ],
    }

    constructor(
        readonly layerType: Layer,
        readonly settingsDao: SettingsDao,
        readonly systemMetadataDao: SystemMetadataDao,
    ) {
        this.externalContract = settingsDao.getExternalContracts(layerType)
        this.deployConfig = new DeployConfig(settingsDao.stage)
        this.factory = new ContractWrapperFactory(layerType, systemMetadataDao, this.deployConfig.confirmations)
    }

    get confirmations(): number {
        return this.deployConfig.confirmations
    }

    async publishContracts(batch: number): Promise<void> {
        const taskBatches = this.taskBatchesMap[this.layerType]
        const completeTasksLength = taskBatches.flat().length
        const tasks = taskBatches[batch]
        if (!taskBatches.length || !tasks) {
            return
        }

        const batchStartVer = taskBatches.slice(0, batch).flat().length
        const batchEndVer = batchStartVer + tasks.length
        console.log(`batchStartVer: ${batchStartVer}, batchEndVer: ${batchEndVer}`)

        const ver = this.settingsDao.getVersion(this.layerType)
        if (ver < batchStartVer) {
            throw new Error(
                `starting version (${ver}) is less than the batch's start version (${batchStartVer}), are you sure the previous batches are completed?`,
            )
        }
        console.log(`publishContracts:${ver}->${completeTasksLength}`)

        // clear metadata if it's the first version
        if (ver === 0) {
            console.log("clearing metadata...")
            this.systemMetadataDao.clearMetadata(this.layerType)
        }

        for (const task of tasks.slice(ver - batchStartVer, batchEndVer - batchStartVer)) {
            await task()
            this.settingsDao.increaseVersion(this.layerType)
        }

        // transfer admin if it's the last batch for current layer
        const isLastBatchForCurrentLayer = taskBatches.length - 1 === batch
        if (!isLastBatchForCurrentLayer) {
            return
        }
        // local are basically in 1 layer, can't transfer twice in the same network. will transfer in the very last batch
        if (this.settingsDao.getChainId("layer1") === this.settingsDao.getChainId("layer2")) {
            const layerWithMoreBatch =
                this.taskBatchesMap.layer1.length > this.taskBatchesMap.layer2.length ? "layer1" : "layer2"
            if (layerWithMoreBatch !== this.layerType) {
                return
            }
        }
        const governance = this.externalContract.foundationGovernance!
        console.log(`${this.layerType} batch ends, transfer proxy admin to ${governance}`)
        await OzContractDeployer.transferProxyAdminOwnership(governance)
        console.log("contract deployment finished.")
    }
}
