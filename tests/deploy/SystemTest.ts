import { expect } from "chai"
import { ethers } from "ethers"
import AmmArtifact from "../../build/contracts/Amm.json"
import ChainlinkL1Artifact from "../../build/contracts/ChainlinkL1.json"
import ClearingHouseArtifact from "../../build/contracts/ClearingHouse.json"
import ClientBridgeArtifact from "../../build/contracts/ClientBridge.json"
import InsuranceFundArtifact from "../../build/contracts/InsuranceFund.json"
import L2PriceFeedArtifact from "../../build/contracts/L2PriceFeed.json"
import MetaTxGatewayArtifact from "../../build/contracts/MetaTxGateway.json"
import RootBridgeArtifact from "../../build/contracts/RootBridge.json"
import { AmmInstanceName, ContractName } from "../../publish/ContractName"
import { SettingsDao } from "../../publish/SettingsDao"
import { SystemMetadataDao } from "../../publish/SystemMetadataDao"
import {
    Amm,
    ChainlinkL1,
    ClearingHouse,
    ClientBridge,
    InsuranceFund,
    L2PriceFeed,
    MetaTxGateway,
    RootBridge,
} from "../../types/ethers"

const RINKEBY = "rinkeby"
const XDAI_URL = "https://rpc.xdaichain.com/"
const XDAI_NAME = "xdai"
const XDAI_CHAINID = 100
const STAGE = "staging"

describe("SystemTest Spec", () => {
    const l1Provider = ethers.getDefaultProvider(RINKEBY)
    const l2Provider = new ethers.providers.JsonRpcProvider(XDAI_URL, { name: XDAI_NAME, chainId: XDAI_CHAINID })
    const settingsDao: SettingsDao = new SettingsDao(STAGE)
    const systemMetadataDao: SystemMetadataDao = new SystemMetadataDao(settingsDao)

    const perpToken = systemMetadataDao.getContractMetadata("layer1", ContractName.PerpToken)
    const chainLinkL1 = systemMetadataDao.getContractMetadata("layer1", ContractName.ChainlinkL1)
    const rootBridge = systemMetadataDao.getContractMetadata("layer1", ContractName.RootBridge)
    const multiTokenMediatorL1 = settingsDao.getExternalContracts("layer1").multiTokenMediatorOnEth
    const ambBridgeL1 = settingsDao.getExternalContracts("layer1").ambBridgeOnEth

    const l2PriceFeed = systemMetadataDao.getContractMetadata("layer2", ContractName.L2PriceFeed)
    const metaTxGateway = systemMetadataDao.getContractMetadata("layer2", ContractName.MetaTxGateway)
    const insuranceFund = systemMetadataDao.getContractMetadata("layer2", ContractName.InsuranceFund)
    const clearingHouse = systemMetadataDao.getContractMetadata("layer2", ContractName.ClearingHouse)
    const clientBridge = systemMetadataDao.getContractMetadata("layer2", ContractName.ClientBridge)
    const ETHUSDC = systemMetadataDao.getContractMetadata("layer2", AmmInstanceName.ETHUSDC)
    const BTCUSDC = systemMetadataDao.getContractMetadata("layer2", AmmInstanceName.BTCUSDC)
    const ambBridgeL2 = settingsDao.getExternalContracts("layer2").ambBridgeOnXDai
    const multiTokenMediatorL2 = settingsDao.getExternalContracts("layer2").multiTokenMediatorOnXDai
    const usdc = settingsDao.getExternalContracts("layer2").usdc
    const multiTokenMediator = settingsDao.getExternalContracts("layer2").multiTokenMediatorOnXDai

    describe("RootBridge", () => {
        let instance: RootBridge

        beforeEach(async () => {
            instance = new ethers.Contract(rootBridge.address, RootBridgeArtifact.abi, l1Provider) as RootBridge
        })

        it("has ChainlinkL1", async () => {
            expect(await instance.priceFeed()).to.eq(chainLinkL1.address)
        })

        it("has ambBridgeL1", async () => {
            expect(await instance.ambBridge()).to.eq(ambBridgeL1)
        })

        it("has MultiTokenMediatorL1", async () => {
            expect(await instance.multiTokenMediator()).to.eq(multiTokenMediatorL1)
        })
    })

    describe("ChainlinkL1", () => {
        let instance: ChainlinkL1

        beforeEach(async () => {
            instance = new ethers.Contract(chainLinkL1.address, ChainlinkL1Artifact.abi, l1Provider) as ChainlinkL1
        })

        it("has RootBridge", async () => {
            expect(await instance.rootBridge()).to.eq(rootBridge.address)
        })

        it("has priceFeedL2Address", async () => {
            expect(await instance.priceFeedL2Address()).to.eq(l2PriceFeed.address)
        })
    })

    describe("MetaTxGateway", async () => {
        let instance: MetaTxGateway

        beforeEach(async () => {
            instance = new ethers.Contract(
                metaTxGateway.address,
                MetaTxGatewayArtifact.abi,
                l2Provider,
            ) as MetaTxGateway
        })

        // with function isInWhitelists(), as whitelistMap is private
        it("has ClientBridge as whitelistMap", async () => {
            expect(await instance.isInWhitelists(clientBridge.address))
        })
    })

    describe("ClientBridge", async () => {
        let instance: ClientBridge

        beforeEach(async () => {
            instance = new ethers.Contract(clientBridge.address, ClientBridgeArtifact.abi, l2Provider) as ClientBridge
        })

        it("has ambBridge", async () => {
            expect(await instance.ambBridge()).to.eq(ambBridgeL2)
        })

        it("has MultiTokenMediatorL2", async () => {
            expect(await instance.multiTokenMediator()).to.eq(multiTokenMediatorL2)
        })

        it("has TrustedForwarder", async () => {
            expect(await instance.isTrustedForwarder(metaTxGateway.address))
        })
    })

    describe("InsuranceFund", async () => {
        let instance: InsuranceFund

        beforeEach(async () => {
            instance = new ethers.Contract(
                insuranceFund.address,
                InsuranceFundArtifact.abi,
                l2Provider,
            ) as InsuranceFund
        })

        // with function isExistedAmm(), as amms are private
        describe("has amms", async () => {
            it("has ETHUSDC", async () => {
                expect(await instance.isExistedAmm(ETHUSDC.address))
            })

            it("has BTCUSDC", async () => {
                expect(await instance.isExistedAmm(BTCUSDC.address))
            })
        })

        it("has USDC as quoteTokens[0]", async () => {
            expect(await instance.quoteTokens(0)).to.eq(usdc)
        })

        // not yet implemented
        it.skip("has exchange", async () => {})

        // there is no perp token on rinkeby?
        it.skip("has perpToken", async () => {
            expect(await instance.perpToken()).to.eq(perpToken.address)
        })

        // not yet implemented
        it.skip("has minter", async () => {})

        // not yet implemented
        it.skip("has inflationMonitor", async () => {})
    })

    describe("L2PriceFeed", async () => {
        let instance: L2PriceFeed

        beforeEach(async () => {
            instance = new ethers.Contract(l2PriceFeed.address, L2PriceFeedArtifact.abi, l2Provider) as L2PriceFeed
        })

        it("has rootBridge", async () => {
            expect(await instance.rootBridge()).to.eq(rootBridge.address)
        })

        it("has ambBridgeL2", async () => {
            expect(await instance.ambBridge()).to.eq(ambBridgeL2)
        })
    })

    describe("ClearingHouse", async () => {
        let instance: ClearingHouse

        beforeEach(async () => {
            instance = new ethers.Contract(
                clearingHouse.address,
                ClearingHouseArtifact.abi,
                l2Provider,
            ) as ClearingHouse
        })

        // for arbitrageurs, not yet implemented
        it("has EOA/arbitrageurs as whitelistMap", async () => {})

        // private
        it("has amms", async () => {})

        // not yet implemented
        it.skip("has StakingReserve as feePool", async () => {
            expect(await instance.feePool()).to.eq(multiTokenMediator)
        })

        it("has InsuranceFund", async () => {
            expect(await instance.insuranceFund()).to.eq(insuranceFund.address)
        })
    })

    describe("Amm", async () => {
        describe("ETHUSDC", async () => {
            let instance: Amm

            beforeEach(async () => {
                instance = new ethers.Contract(ETHUSDC.address, AmmArtifact.abi, l2Provider) as Amm
            })

            // private
            it.skip("has ClearingHouse as counterParty", async () => {})

            it("has quoteAsset", async () => {
                expect(await instance.quoteAsset()).to.eq(usdc)
            })

            it("has L2PriceFeed", async () => {
                expect(await instance.priceFeed()).to.eq(l2PriceFeed.address)
            })
        })

        describe("BTCUSDC", async () => {
            let instance: Amm

            beforeEach(async () => {
                instance = new ethers.Contract(BTCUSDC.address, AmmArtifact.abi, l2Provider) as Amm
            })

            // private
            it.skip("has ClearingHouse", async () => {})

            it("has quoteAsset", async () => {
                expect(await instance.quoteAsset()).to.eq(usdc)
            })

            it("has L2PriceFeed", async () => {
                expect(await instance.priceFeed()).to.eq(l2PriceFeed.address)
            })
        })
    })
})
