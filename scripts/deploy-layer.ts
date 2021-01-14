/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { mkdir, mv, test } from "shelljs"
import { ContractPublisher } from "../publish/ContractPublisher"
import { SettingsDao } from "../publish/SettingsDao"
import { SystemMetadataDao } from "../publish/SystemMetadataDao"
import { AccountMetadata, Layer, Network, ozNetworkFile, Stage } from "./common"
import { getOpenZeppelinDir } from "./path"

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
    console.log(`deployer=${address}`)
    const publisher = new ContractPublisher(layerType, settingsDao, systemMetadataDao)

    // workaround: when deploying staging/production to the same network (eg. xdai)
    // we don't want to overwrite the .openzeppelin config file
    // so we'll keep the original file in our own dir (separate by different stage).
    const ozSettingsFileName = ozNetworkFile[network]
    const stagePath = `${getOpenZeppelinDir()}/${stage}`
    const sourceFile = `${stagePath}/${ozSettingsFileName}.json`
    const destinationFile = `${getOpenZeppelinDir()}/${ozSettingsFileName}.json`

    // 1. before deploying, copy from source to destination first
    // 2. during deploying, open zeppelin sdk will update the destination file
    // 3. after deploying, we'll copy the updated destination files back to the dir managed by us
    if (!test("-e", sourceFile)) {
        mkdir("-p", stagePath)
    } else {
        mv(sourceFile, destinationFile)
    }

    try {
        await publisher.publishContracts(batch)
    } finally {
        mv(destinationFile, sourceFile)
    }
}
