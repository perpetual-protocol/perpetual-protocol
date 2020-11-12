/* eslint-disable @typescript-eslint/no-non-null-assertion */
import BN from "bn.js"
import { ethers } from "ethers"
import { ExternalContracts, Layer } from "../scripts/common"
import { Amm } from "./contract/Amm"
import { AmmReader } from "./contract/AmmReader"
import { ChainlinkL1 } from "./contract/ChainlinkL1"
import { ClearingHouse } from "./contract/ClearingHouse"
import { ClearingHouseViewer } from "./contract/ClearingHouseViewer"
import { ClientBridge } from "./contract/ClientBridge"
import { InsuranceFund } from "./contract/InsuranceFund"
import { L2PriceFeed } from "./contract/L2PriceFeed"
import { MetaTxGateway } from "./contract/MetaTxGateway"
import { PerpToken } from "./contract/PerpToken"
import { RootBridge } from "./contract/RootBridge"
import { TetherToken } from "./contract/TetherToken"
import { AmmContractName, ContractName } from "./ContractName"
import { OzScript } from "./OzScript"
import { SettingsDao } from "./SettingsDao"
import { SystemMetadataDao } from "./SystemMetadataDao"

const TetherTokenArtifacts = artifacts.require("TetherToken")
const MultiTokenMediatorMockArtifacts = artifacts.require("MultiTokenMediatorMock")

export type DeployTask = () => Promise<void>

/* eslint-disable no-console */
export class ContractPublisher {
    readonly externalContract: ExternalContracts

    readonly taskBatchesMap: Record<Layer, DeployTask[][]> = {
        layer1: [
            // batch 0
            [
                async (): Promise<void> => {
                    // deploy USDT
                    // only deploy USDT on local tests
                    if (this.settingsDao.isLocal()) {
                        const tetherToken = new TetherToken(this.layerType, this.systemMetadataDao, this.ozScript)
                        await tetherToken.deploy()
                    }
                },
                async (): Promise<void> => {
                    // deploy perp token
                    // only do it on non-mainnet
                    if (!this.settingsDao.isMainnet()) {
                        const perpToken = new PerpToken(this.layerType, this.systemMetadataDao, this.ozScript)
                        await perpToken.deploy()

                        // transfer to foundation multisig
                        const perpTokenInstance = await perpToken.instance()

                        if (!this.settingsDao.isLocal()) {
                            const foundationMultisig = this.externalContract.foundationMultisig!
                            if ((await perpTokenInstance!.owner()) !== foundationMultisig) {
                                await perpTokenInstance!.setOwner(foundationMultisig)
                                console.log(`Set PERP's owner to ${foundationMultisig}`)
                            }
                        }
                    }
                },
                async (): Promise<void> => {
                    // distribute PERP to faucet
                    // should only do it on testnets
                    if (!this.settingsDao.isMainnet() && !this.settingsDao.isLocal()) {
                        console.log("distributing PERP to faucet...")
                        const perpToken = new PerpToken(this.layerType, this.systemMetadataDao, this.ozScript)
                        const perpTokenInstance = await perpToken.instance()
                        const totalSupply = await perpTokenInstance!.totalSupply()
                        await perpTokenInstance!.transfer(this.externalContract.testnetFaucet!, totalSupply.toString())
                    }
                },
                async (): Promise<void> => {
                    // deploy root bridge
                    const ambBridgeOnEth = this.externalContract.ambBridgeOnEth!
                    const multiTokenMediatorOnEth = this.externalContract.multiTokenMediatorOnEth!
                    const rootBridge = new RootBridge(this.layerType, this.systemMetadataDao, this.ozScript)
                    await rootBridge.deploy(ambBridgeOnEth, multiTokenMediatorOnEth)
                },
            ],
            // batch 1
            [
                async (): Promise<void> => {
                    // distribute USDT to faucet and arbitrageur
                    // only distribute USDT in testnets
                    if (!this.settingsDao.isMainnet() && !this.settingsDao.isLocal()) {
                        console.log("distributing USDT to insurance fund and arbitrageur...")

                        const tetherTokenInstance = await TetherTokenArtifacts.at(
                            this.settingsDao.getExternalContracts("layer1").tether!,
                        )
                        const multiTokenMediatorInstance = await MultiTokenMediatorMockArtifacts.at(
                            this.settingsDao.getExternalContracts("layer1").multiTokenMediatorOnEth!,
                        )

                        // token
                        await tetherTokenInstance!.approve(
                            this.settingsDao.getExternalContracts("layer1").multiTokenMediatorOnEth!,
                            "0",
                        )
                        await tetherTokenInstance!.approve(
                            this.settingsDao.getExternalContracts("layer1").multiTokenMediatorOnEth!,
                            ethers.constants.MaxUint256.toString(),
                        )
                        await multiTokenMediatorInstance!.relayTokens(
                            tetherTokenInstance!.address,
                            this.systemMetadataDao.getContractMetadata("layer2", ContractName.InsuranceFund).address,
                            new BN(100000000).mul(TetherToken.DEFAULT_DIGITS).toString(),
                        )
                        await multiTokenMediatorInstance!.relayTokens(
                            tetherTokenInstance!.address,
                            this.settingsDao.getExternalContracts("layer2").arbitrageur!,
                            new BN(100000000).mul(TetherToken.DEFAULT_DIGITS).toString(),
                        )
                    }
                },
                async (): Promise<void> => {
                    // deploy chainlink price feed on L1
                    const rootBridge = await new RootBridge(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const chainlinkL1 = new ChainlinkL1(this.layerType, this.systemMetadataDao, this.ozScript)
                    const chainlinkL1Instance = await chainlinkL1.deploy(
                        rootBridge!.address,
                        this.systemMetadataDao.getContractMetadata("layer2", ContractName.L2PriceFeed).address,
                    )
                    await rootBridge!.setPriceFeed(chainlinkL1Instance.address)
                },
                async (): Promise<void> => {
                    // add aggregator of chainlink price feed on L1
                    console.log("setting ChainlinkL1 aggregators...")
                    const chainlinkL1 = new ChainlinkL1(this.layerType, this.systemMetadataDao, this.ozScript)
                    await chainlinkL1.addAggregators()
                },
            ],
        ],
        layer2: [
            // batch 0
            [
                async (): Promise<void> => {
                    // deploy meta tx gateway
                    const metaTxGateway = new MetaTxGateway(this.layerType, this.systemMetadataDao, this.ozScript)
                    await metaTxGateway.deploy("Perp", "1", this.settingsDao.getChainId("layer1"))
                },
                async (): Promise<void> => {
                    // deploy client bridge
                    const ambBridgeOnXDai = this.externalContract.ambBridgeOnXDai!
                    const multiTokenMediatorOnXDai = this.externalContract.multiTokenMediatorOnXDai!
                    const metaTxGatewayInstance = await new MetaTxGateway(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const clientBridge = new ClientBridge(this.layerType, this.systemMetadataDao, this.ozScript)
                    const clientBridgeInstance = await clientBridge.deploy(
                        ambBridgeOnXDai,
                        multiTokenMediatorOnXDai,
                        metaTxGatewayInstance!.address,
                    )
                    await metaTxGatewayInstance!.addToWhitelists(clientBridgeInstance.address)
                },
                async (): Promise<void> => {
                    // deploy insurance fund
                    const insuranceFund = new InsuranceFund(this.layerType, this.systemMetadataDao, this.ozScript)
                    await insuranceFund.deploy()
                },
                async (): Promise<void> => {
                    // deploy L2 price feed
                    const l2PriceFeed = new L2PriceFeed(this.layerType, this.systemMetadataDao, this.ozScript)
                    await l2PriceFeed.deploy(
                        this.settingsDao.getExternalContracts("layer2").ambBridgeOnXDai!,
                        "0x0000000000000000000000000000000000000000", // root bridge not deployed yet
                    )
                },
                async (): Promise<void> => {
                    // add first L2 aggregators
                    console.log("setting L2PriceFeed aggregators...")
                    const l2PriceFeed = new L2PriceFeed(this.layerType, this.systemMetadataDao, this.ozScript)
                    await l2PriceFeed!.addAggregators()
                },
                async (): Promise<void> => {
                    // deploy clearing house
                    const insuranceFundInstance = await new InsuranceFund(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const metaTxGatewayInstance = await new MetaTxGateway(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const clearingHouse = new ClearingHouse(this.layerType, this.systemMetadataDao, this.ozScript)
                    const clearingHouseInstance = await clearingHouse.deploy(
                        insuranceFundInstance!.address,
                        metaTxGatewayInstance!.address,
                    )
                    await metaTxGatewayInstance!.addToWhitelists(clearingHouseInstance.address)
                    await insuranceFundInstance!.setBeneficiary(clearingHouseInstance.address)
                },
                async (): Promise<void> => {
                    // deploy amm
                    const l2PriceFeedInstance = await new L2PriceFeed(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const amm = new Amm(this.layerType, this.systemMetadataDao, this.ozScript, AmmContractName.ETHUSDT)
                    const tetherAddress = this.settingsDao.isLocal()
                        ? // USDT is custom-managed by us
                          this.systemMetadataDao.getContractMetadata("layer1", ContractName.TetherToken).address
                        : // USDT is externally managed
                          this.settingsDao.getExternalContracts("layer2").tether!

                    await amm.deploy(l2PriceFeedInstance!.address, tetherAddress)
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm ETHUSDT...")
                    const insuranceFundInstance = await new InsuranceFund(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const clearingHouseInstance = await new ClearingHouse(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const amm = new Amm(this.layerType, this.systemMetadataDao, this.ozScript, AmmContractName.ETHUSDT)
                    const ammInstance = await amm.instance()
                    const { maxHoldingBaseAsset } = amm.getAmmProperties()
                    if (maxHoldingBaseAsset.gt(new BN(0))) {
                        await ammInstance!.setMaxHoldingBaseAsset({ d: maxHoldingBaseAsset.toString() })
                    }
                    await ammInstance!.setCounterParty(clearingHouseInstance!.address)
                    await insuranceFundInstance!.addAmm(ammInstance!.address)
                },
                async (): Promise<void> => {
                    // deploy amm
                    const l2PriceFeedInstance = await new L2PriceFeed(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const amm = new Amm(this.layerType, this.systemMetadataDao, this.ozScript, AmmContractName.BTCUSDT)
                    const tetherAddress = this.settingsDao.isLocal()
                        ? // USDT is custom-managed by us
                          this.systemMetadataDao.getContractMetadata("layer1", ContractName.TetherToken).address
                        : // USDT is externally managed
                          this.settingsDao.getExternalContracts("layer2").tether!

                    await amm.deploy(l2PriceFeedInstance!.address, tetherAddress)
                },
                async (): Promise<void> => {
                    // setup amm
                    console.log("setting up Amm BTCUSDT...")
                    const insuranceFundInstance = await new InsuranceFund(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const clearingHouseInstance = await new ClearingHouse(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const amm = new Amm(this.layerType, this.systemMetadataDao, this.ozScript, AmmContractName.BTCUSDT)
                    const ammInstance = await amm.instance()
                    const { maxHoldingBaseAsset } = amm.getAmmProperties()
                    if (maxHoldingBaseAsset.gt(new BN(0))) {
                        await ammInstance!.setMaxHoldingBaseAsset({ d: maxHoldingBaseAsset.toString() })
                    }
                    await ammInstance!.setCounterParty(clearingHouseInstance!.address)
                    await insuranceFundInstance!.addAmm(ammInstance!.address)
                },
                async (): Promise<void> => {
                    //  deploy clearingHouseViewer
                    const clearingHouseInstance = await new ClearingHouse(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    const clearingHouseViewer = new ClearingHouseViewer(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    )
                    await clearingHouseViewer.deploy(clearingHouseInstance!.address)
                },
                async (): Promise<void> => {
                    //  deploy ammReader
                    const ammReader = new AmmReader(this.layerType, this.systemMetadataDao, this.ozScript)
                    await ammReader.deploy()
                },
                async (): Promise<void> => {
                    // open amm
                    console.log("opening Amm ETHUSDT...")
                    const ethUsdtInstance = await new Amm(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                        AmmContractName.ETHUSDT,
                    ).instance()
                    await ethUsdtInstance!.setOpen(true)
                },
                async (): Promise<void> => {
                    // open amm
                    console.log("opening Amm BTCUSDT...")
                    const btcUsdtInstance = await new Amm(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                        AmmContractName.BTCUSDT,
                    ).instance()
                    await btcUsdtInstance!.setOpen(true)
                },
                async (): Promise<void> => {
                    const l2PriceFeedInstance = await new L2PriceFeed(
                        this.layerType,
                        this.systemMetadataDao,
                        this.ozScript,
                    ).instance()
                    await l2PriceFeedInstance!.setKeeper(
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
    }

    async publishContracts(batch: number): Promise<void> {
        const taskBatches = this.taskBatchesMap[this.layerType]
        const completeTasksLength = taskBatches.flat().length
        const tasks = taskBatches[batch]
        if (!tasks) {
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
        console.log(`publishContracts:${ver}->${completeTasksLength} by ${this.from!}`)

        // clear metadata if it's the first version
        if (ver === 0) {
            console.log("clearing metadata...")
            this.systemMetadataDao.clearMetadata(this.layerType)
        }

        for (const task of tasks.slice(ver - batchStartVer, batchEndVer - batchStartVer)) {
            await this.attemptExec(task)
            this.settingsDao.increaseVersion(this.layerType)
        }
    }

    get from(): string {
        return this.ozScript.networkConfig.txParams.from!
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
