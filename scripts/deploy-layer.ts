/* eslint-disable @typescript-eslint/no-non-null-assertion */
// import { buidlerArguments, config, web3 } from "@nomiclabs/buidler"
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { Wallet } from "ethers"
import {
    HOMESTEAD_MNEMONIC,
    KOVAN_MNEMONIC,
    RINKEBY_MNEMONIC,
    ROPSTEN_MNEMONIC,
    SOKOL_MNEMONIC,
    XDAI_MNEMONIC,
} from "../constants"
import { AccountMetadata, Layer, Network, Stage } from "./common"

async function getFromAccount(bre: BuidlerRuntimeEnvironment): Promise<string> {
    const network = bre.buidlerArguments.network! as Network
    console.log(`network=${network}`)
    if (network === "localhost") {
        return (await bre.web3.eth.getAccounts())[0]
    } else if (network === "ropsten") {
        const wallet = Wallet.fromMnemonic(ROPSTEN_MNEMONIC || "")
        return wallet.address
    } else if (network === "kovan") {
        const wallet = Wallet.fromMnemonic(KOVAN_MNEMONIC || "")
        return wallet.address
    } else if (network === "rinkeby") {
        const wallet = Wallet.fromMnemonic(RINKEBY_MNEMONIC || "")
        return wallet.address
    } else if (network === "homestead") {
        const wallet = Wallet.fromMnemonic(HOMESTEAD_MNEMONIC || "")
        return wallet.address
    } else if (network === "sokol") {
        const wallet = Wallet.fromMnemonic(SOKOL_MNEMONIC || "")
        return wallet.address
    } else if (network === "xdai") {
        const wallet = Wallet.fromMnemonic(XDAI_MNEMONIC || "")
        return wallet.address
    } else {
        throw new Error("network not found: " + network)
    }
}

export async function deployLayer(
    stage: Stage,
    layerType: Layer,
    batch: number,
    bre: BuidlerRuntimeEnvironment,
): Promise<void> {
    const from = await getFromAccount(bre)
    console.log("from:", from)
    const network = bre.buidlerArguments.network! as Network

    // only expose accounts when deploy on local node, otherwise assign a empty array
    const isLocalhost: boolean = network === "localhost"
    const accounts = isLocalhost ? (bre.config.networks.buidlerevm.accounts as AccountMetadata[]) : []

    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    systemMetadataDao.setAccounts(layerType, accounts)
    const ozScript = new OzScript(bre.web3.currentProvider, from)
    const publisher = new ContractPublisher(layerType, settingsDao, systemMetadataDao, ozScript)

    await publisher.publishContracts(batch)
}
