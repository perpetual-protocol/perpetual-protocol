/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { ContractPublisher } from "../publish/ContractPublisher"
import { OzScript } from "../publish/OzScript"
import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { AccountMetadata, Layer, Network, Stage } from "./common"

export type DeployTask = () => Promise<void>

export async function deployLayer(
    stage: Stage,
    layerType: Layer,
    batch: number,
    bre: BuidlerRuntimeEnvironment,
): Promise<void> {
    const network = bre.buidlerArguments.network! as Network

    // only expose accounts when deploy on local node, otherwise assign a empty array
    const isLocalhost: boolean = network === "localhost"
    const accounts = isLocalhost ? (bre.config.networks.buidlerevm.accounts as AccountMetadata[]) : []

    const settingsDao = new SettingsDao(stage)
    const systemMetadataDao = new SystemMetadataDao(settingsDao)
    systemMetadataDao.setAccounts(layerType, accounts)

    const signers = await ethers.getSigners()
    const address = await signers[0].getAddress()
    const ozScript = new OzScript(bre.web3.currentProvider, address)
    const publisher = new ContractPublisher(layerType, settingsDao, systemMetadataDao, ozScript)

    await publisher.publishContracts(batch)
}
