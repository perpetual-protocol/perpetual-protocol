/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { BigNumber } from "ethers"
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
    PerpToken,
    RootBridge,
    TetherToken,
} from "../types/ethers"
import { IMultiTokenMediator } from "../types/ethers/IMultiTokenMediator"
import { ContractWrapperFactory } from "./contract/ContractWrapperFactory"
import { DeployConfig } from "./contract/DeployConfig"
import { AmmContractName, ContractName } from "./ContractName"
import { OzScript } from "./OzScript"
import { SettingsDao } from "./SettingsDao"
import { SystemMetadataDao } from "./SystemMetadataDao"

export type DeployTask = () => Promise<void>

/* eslint-disable no-console */
export class ContractPublisher {
    readonly externalContract: ExternalContracts
    readonly factory: ContractWrapperFactory
    readonly deployConfig: DeployConfig
    readonly confirmations = 5

    readonly taskBatchesMap: Record<Layer, DeployTask[][]> = {
        layer1: [
            // batch 0
            [
                async (): Promise<void> => {
                    if (!this.deployConfig.deployUsdt) {
                        return
                    }

                    // deploy USDT
                    const tetherContract = this.factory.create<TetherToken>(ContractName.TetherToken)
                    await tetherContract.deployImmutableContract(
                        this.deployConfig.usdtInitSupply,
                        "Tether USD",
                        "USDT",
                        6,
                    )
                },
                async (): Promise<void> => {
                    if (!this.deployConfig.deployPerp) {
                        return
                    }

                    // deploy perp token
                    const supply = this.deployConfig.perpInitSupply
                    const perpContract = this.factory.create<PerpToken>(ContractName.PerpToken)
                    const perpToken = await perpContract.deployImmutableContract(supply)

                    // distribute PERP to faucet
                    // should only do it on testnets
                    if (this.externalContract.testnetFaucet) {
                        await perpToken.transfer(this.externalContract.testnetFaucet!, supply.toString())
                    }
                },
                async (): Promise<void> => {
                    // deploy root bridge
                    const rootBridgeContract = this.factory.create<RootBridge>(ContractName.RootBridge)
                    await rootBridgeContract.deployUpgradableContract(
                        this.externalContract.ambBridgeOnEth!,
                        this.externalContract.multiTokenMediatorOnEth!,
                    )
                },
            ],
            // batch 1
            [
                async (): Promise<void> => {
                    // only distribute USDT in testnets
                    if (!this.deployConfig.usdtToFaucet) {
                        return
                    }

                    console.log("distributing USDT to insurance fund and arbitrageur...")

                    // prepare address from layer 1 and layer 2
                    const tetherOnEth = this.settingsDao.getExternalContracts("layer1").tether!
                    const mediatorOnEth = this.settingsDao.getExternalContracts("layer1").multiTokenMediatorOnEth!
                    const insuranceFundOnXdai = this.systemMetadataDao.getContractMetadata(
                        "layer2",
                        ContractName.InsuranceFund,
                    ).address
                    const arbOnXdai = this.settingsDao.getExternalContracts("layer2").arbitrageur!

                    // prepare contract instance
                    const tether = (await ethers.getContractAt(ContractName.TetherToken, tetherOnEth)) as TetherToken
                    const mediator = (await ethers.getContractAt(
                        ContractName.MultiTokenMediatorMock,
                        mediatorOnEth,
                    )) as IMultiTokenMediator
                    const tetherDigits = await tether.decimals()

                    // approve tether and distribute to arb and insurance fund
                    await (await tether.approve(mediatorOnEth, "0")).wait(this.confirmations)
                    await (await tether.approve(mediatorOnEth, ethers.constants.MaxUint256.toString())).wait(
                        this.confirmations,
                    )
                    await mediator.relayTokens(
                        tetherOnEth,
                        insuranceFundOnXdai,
                        BigNumber.from("100000000")
                            .mul(tetherDigits)
                            .toString(),
                    )
                    await mediator.relayTokens(
                        tetherOnEth,
                        arbOnXdai,
                        BigNumber.from("100000000")
                            .mul(tetherDigits)
                            .toString(),
                    )
                },
                async (): Promise<void> => {
                    console.log("deploy chainlink price feed on L1")
                    const l2PriceFeedOnXdai = this.systemMetadataDao.getContractMetadata(
                        "layer2",
                        ContractName.L2PriceFeed,
                    ).address
                    const rootBridgeContract = this.factory.create<RootBridge>(ContractName.RootBridge)
                    const rootBridge = await rootBridgeContract.instance()
                    const chainlinkContract = this.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
                    const chainlink = await chainlinkContract.deployUpgradableContract(
                        rootBridge.address,
                        l2PriceFeedOnXdai,
                    )
                    await (await rootBridge.setPriceFeed(chainlink.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    console.log("add aggregator of chainlink price feed on L1...")
                    const chainlinkContract = this.factory.create<ChainlinkL1>(ContractName.ChainlinkL1)
                    const chainlink = await chainlinkContract.instance()
                    for (const priceFeedKey in this.deployConfig.chainlinkMap) {
                        const address = this.deployConfig.chainlinkMap[priceFeedKey]
                        await (await chainlink.addAggregator(ethers.utils.id(priceFeedKey.toString()), address)).wait(
                            this.confirmations,
                        )
                    }
                },
            ],
        ],
        layer2: [
            // batch 0
            [
                async (): Promise<void> => {
                    // deploy meta tx gateway
                    const chainId = this.settingsDao.getChainId("layer1")
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    await metaTxGatewayContract.deployUpgradableContract("Perp", "1", chainId)
                },
                async (): Promise<void> => {
                    // deploy client bridge
                    const ambBridgeOnXDai = this.externalContract.ambBridgeOnXDai!
                    const multiTokenMediatorOnXDai = this.externalContract.multiTokenMediatorOnXDai!
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    const metaTxGateway = await metaTxGatewayContract.instance()

                    const clientBridgeContract = this.factory.create<ClientBridge>(ContractName.ClientBridge)
                    const clientBridge = await clientBridgeContract.deployUpgradableContract(
                        ambBridgeOnXDai,
                        multiTokenMediatorOnXDai,
                        metaTxGateway.address,
                    )
                    await (await metaTxGateway.addToWhitelists(clientBridge.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // deploy insurance fund
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    await insuranceFundContract.deployUpgradableContract()
                },
                async (): Promise<void> => {
                    // deploy L2 price feed
                    const ambBridgeOnXDaiAddr = this.settingsDao.getExternalContracts("layer2").ambBridgeOnXDai!
                    const rootBridgeOnEthAddr = this.systemMetadataDao.getContractMetadata(
                        "layer1",
                        ContractName.RootBridge,
                    ).address
                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    await l2PriceFeedContract.deployUpgradableContract(ambBridgeOnXDaiAddr, rootBridgeOnEthAddr)
                },
                async (): Promise<void> => {
                    console.log("add aggregators to L2PriceFeed")
                    const l2PriceFeed = await this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed).instance()
                    for (const priceFeedKey in this.deployConfig.chainlinkMap) {
                        await (await l2PriceFeed.addAggregator(ethers.utils.id(priceFeedKey.toString()))).wait(
                            this.confirmations,
                        )
                    }
                },
                async (): Promise<void> => {
                    // deploy clearing house
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const metaTxGatewayContract = this.factory.create<MetaTxGateway>(ContractName.MetaTxGateway)
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)

                    const clearingHouse = await clearingHouseContract.deployUpgradableContract(
                        this.deployConfig.initMarginRequirement,
                        this.deployConfig.maintenanceMarginRequirement,
                        this.deployConfig.liquidationFeeRatio,
                        insuranceFundContract.address!,
                        metaTxGatewayContract.address!,
                    )
                    const metaTxGateway = await metaTxGatewayContract.instance()
                    await (await metaTxGateway.addToWhitelists(clearingHouse.address)).wait(this.confirmations)
                    const insuranceFund = await insuranceFundContract.instance()
                    await (await insuranceFund.setBeneficiary(clearingHouse.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // deploy amm
                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    const ammContract = this.factory.createAmm(AmmContractName.ETHUSDT)
                    const tetherAddr = this.deployConfig.deployUsdt
                        ? // USDT is custom-managed by us
                          this.systemMetadataDao.getContractMetadata("layer1", ContractName.TetherToken).address
                        : // USDT is externally managed
                          this.settingsDao.getExternalContracts("layer2").tether!
                    await ammContract.deployUpgradableContract(
                        this.deployConfig.ammConfigMap,
                        l2PriceFeedContract.address!,
                        tetherAddr,
                    )
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm ETHUSDT...")
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)
                    const ammContract = this.factory.createAmm(AmmContractName.ETHUSDT)
                    const amm = await ammContract.instance()
                    const insuranceFund = await insuranceFundContract.instance()
                    const { maxHoldingBaseAsset } = this.deployConfig.ammConfigMap[AmmContractName.ETHUSDT].properties

                    if (maxHoldingBaseAsset.gt(0)) {
                        await (await amm.setMaxHoldingBaseAsset({ d: maxHoldingBaseAsset.toString() })).wait(
                            this.confirmations,
                        )
                    }
                    await (await amm.setCounterParty(clearingHouseContract.address!)).wait(this.confirmations)
                    await (await insuranceFund.addAmm(amm.address)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // deploy amm

                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    const ammContract = this.factory.createAmm(AmmContractName.BTCUSDT)
                    const tetherAddr = this.deployConfig.deployUsdt
                        ? // USDT is custom-managed by us
                          this.systemMetadataDao.getContractMetadata("layer1", ContractName.TetherToken).address
                        : // USDT is externally managed
                          this.settingsDao.getExternalContracts("layer2").tether!
                    await ammContract.deployUpgradableContract(
                        this.deployConfig.ammConfigMap,
                        l2PriceFeedContract.address!,
                        tetherAddr,
                    )
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm BTCUSDT...")
                    const insuranceFundContract = this.factory.create<InsuranceFund>(ContractName.InsuranceFund)
                    const clearingHouseContract = this.factory.create<ClearingHouse>(ContractName.ClearingHouse)
                    const ammContract = this.factory.createAmm(AmmContractName.BTCUSDT)
                    const amm = await ammContract.instance()
                    const insuranceFund = await insuranceFundContract.instance()
                    const { maxHoldingBaseAsset } = this.deployConfig.ammConfigMap[AmmContractName.BTCUSDT].properties

                    if (maxHoldingBaseAsset.gt(0)) {
                        await (await amm.setMaxHoldingBaseAsset({ d: maxHoldingBaseAsset.toString() })).wait(
                            this.confirmations,
                        )
                    }
                    await (await amm.setCounterParty(clearingHouseContract.address!)).wait(this.confirmations)
                    await (await insuranceFund.addAmm(amm.address)).wait(this.confirmations)
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
                    // open amm
                    console.log("opening Amm ETHUSDT...")
                    const ethUsdt = await this.factory.createAmm(AmmContractName.ETHUSDT).instance()
                    await (await ethUsdt.setOpen(true)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    // open amm
                    console.log("opening Amm ETHUSDT...")
                    const btcUsdt = await this.factory.createAmm(AmmContractName.BTCUSDT).instance()
                    await (await btcUsdt.setOpen(true)).wait(this.confirmations)
                },
                async (): Promise<void> => {
                    const l2PriceFeedContract = this.factory.create<L2PriceFeed>(ContractName.L2PriceFeed)
                    const l2PriceFeedInstance = await l2PriceFeedContract.instance()
                    await l2PriceFeedInstance.setKeeper(
                        this.systemMetadataDao.getContractMetadata("layer1", ContractName.RootBridge).address,
                    )
                },
            ],
        ],
    }

    constructor(
        readonly layerType: Layer,
        readonly settingsDao: SettingsDao,
        readonly systemMetadataDao: SystemMetadataDao,
        readonly ozScript: OzScript,
    ) {
        this.externalContract = settingsDao.getExternalContracts(layerType)
        this.factory = new ContractWrapperFactory(layerType, systemMetadataDao)
        this.deployConfig = new DeployConfig(settingsDao.stage)
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
            await this.attemptExec(task)
            this.settingsDao.increaseVersion(this.layerType)
        }

        // transfer admin if it's the last batch for current layer
        const isLastBatchForCurrentLayer = taskBatches.length - 1 === batch
        if (!isLastBatchForCurrentLayer) {
            return
        }
        // local are basically in 1 layer, can't transfer twice in the same network. will transfer in the very last batch
        if (this.settingsDao.isLocal()) {
            const layerWithMoreBatch =
                this.taskBatchesMap.layer1.length > this.taskBatchesMap.layer2.length ? "layer1" : "layer2"
            if (layerWithMoreBatch !== this.layerType) {
                return
            }
        }

        // TODO add a prompt
        // const governance = this.externalContract.foundationGovernance!
        // console.log(`${this.layerType} batch ends, transfer proxy admin to ${governance}`)
        // await OzContractDeployer.transferProxyAdminOwnership(governance)
        // console.log("contract deployment finished.")
    }

    private async attemptExec(task: DeployTask, retriesRemaining = 1): Promise<void> {
        try {
            await task()
        } catch (error) {
            console.error(error)
            if (retriesRemaining > 0) {
                console.log("Execute publish task failed, retry....")
                return this.attemptExec(task, retriesRemaining - 1)
            }
            throw new Error("Exceed retry limit")
        }
    }
}
