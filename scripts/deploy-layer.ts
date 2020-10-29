/* eslint-disable @typescript-eslint/no-non-null-assertion */
// import { buidlerArguments, config, web3 } from "@nomiclabs/buidler"
import { ConfigManager } from "@openzeppelin/cli"
import { Wallet } from "ethers"
import { ContractPublisher } from "../publish/ContractPublisher"
import { AccountMetadata, SystemMetadataDao } from "../publish/SystemMetadataDao"
import { OzScript } from "../publish/OzScript"
import { SettingsDao } from "../publish/SettingsDao"
import { Layer, Network, Stage } from "./common"
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"

export async function getFromAccount(bre: BuidlerRuntimeEnvironment): Promise<string> {
    const network = bre.buidlerArguments.network! as Network
    console.log(`network=${network}`)
    if (network === "localhost") {
        return (await bre.web3.eth.getAccounts())[0]
    } else if (network === "ropsten") {
        const wallet = Wallet.fromMnemonic(process.env["ROPSTEN_MNEMONIC"] || "")
        return wallet.address
    } else if (network === "kovan") {
        const wallet = Wallet.fromMnemonic(process.env["KOVAN_MNEMONIC"] || "")
        return wallet.address
    } else if (network === "rinkeby") {
        const wallet = Wallet.fromMnemonic(process.env["RINKEBY_MNEMONIC"] || "")
        return wallet.address
    } else if (network === "homestead") {
        const wallet = Wallet.fromMnemonic(process.env["HOMESTEAD_MNEMONIC"] || "")
        return wallet.address
    } else if (network === "sokol") {
        const wallet = Wallet.fromMnemonic(process.env["SOKOL_MNEMONIC"] || "")
        return wallet.address
    } else if (network === "xdai") {
        const wallet = Wallet.fromMnemonic(process.env["XDAI_MNEMONIC"] || "")
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
    const ozNetworkConfig = await ConfigManager.initNetworkConfiguration({ network, from })

    // only expose accounts when deploy on local node, otherwise assign a empty array
    const isLocalhost: boolean = network === "localhost"
    const accounts = isLocalhost ? (bre.config.networks.buidlerevm.accounts as AccountMetadata[]) : []

    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    systemMetadataDao.setAccounts(layerType, accounts)
    const ozScript = new OzScript(bre.web3.currentProvider, ozNetworkConfig)
    const publisher = new ContractPublisher(layerType, batch, settingsDao, systemMetadataDao, ozScript)

    await publisher.publishContracts()
}
