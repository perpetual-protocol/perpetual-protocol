/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { ShellString } from "shelljs"
import { ExternalContracts, Layer, MigrationIndex, Network, Stage, SystemDeploySettings } from "../scripts/common"
import { getSettingsDir } from "../scripts/path"
import production from "./settings/production.json"
import staging from "./settings/staging.json"

export class SettingsDao {
    readonly settingsCached!: SystemDeploySettings
    constructor(readonly stage: Stage) {
        switch (stage) {
            case "production":
                this.settingsCached = production as SystemDeploySettings
                break
            case "staging":
                this.settingsCached = staging as SystemDeploySettings
                break
            case "test":
                try {
                    this.settingsCached = require(this.settingsFilePath)
                } catch (e) {
                    console.log(`can not find ${this.settingsFilePath}, generating file...`)
                    this.settingsCached = {
                        layers: {
                            layer1: {
                                chainId: 31337,
                                network: "localhost",
                                externalContracts: {
                                    foundationGovernance: "0xa230A4f6F38D904C2eA1eE95d8b2b8b7350e3d79",
                                    rewardGovernance: "0x9FE5f5bbbD3f2172Fa370068D26185f3d82ed9aC",
                                    ambBridgeOnEth: "0xD4075FB57fCf038bFc702c915Ef9592534bED5c1",
                                    multiTokenMediatorOnEth: "0x30F693708fc604A57F1958E3CFa059F902e6d4CB",
                                    usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                                    perp: "0x0078371BDeDE8aAc7DeBfFf451B74c5EDB385Af7",
                                },
                            },
                            layer2: {
                                chainId: 31337,
                                network: "localhost",
                                externalContracts: {
                                    foundationGovernance: "0x9E9DFaCCABeEcDA6dD913b3685c9fe908F28F58c",
                                    ambBridgeOnXDai: "0xc38D4991c951fE8BCE1a12bEef2046eF36b0FA4A",
                                    multiTokenMediatorOnXDai: "0xA34c65d76b997a824a5E384471bBa73b0013F5DA",
                                    usdc: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83",
                                    arbitrageur: "0x68dfc526037E9030c8F813D014919CC89E7d4d74",
                                    perp: "0x0C6c3C47A1f650809B0D1048FDf9603e09473D7E",
                                },
                            },
                        },
                        nextMigration: {
                            batchIndex: 0,
                            taskIndex: 0,
                        },
                    }
                }
                break
            default:
                throw new Error(`Stage not found=${stage}`)
        }
    }

    // TODO easy to break when rename file or directory
    private get settingsFilePath(): string {
        return `${getSettingsDir()}/${this.stage}.json`
    }

    getStage(): Stage {
        return this.stage
    }

    getSystemDeploySettings(): SystemDeploySettings {
        return this.settingsCached
    }

    getNextMigration(): MigrationIndex {
        return this.getSystemDeploySettings().nextMigration
    }

    resetNextMigration(): void {
        this.settingsCached.nextMigration.batchIndex = 0
        this.settingsCached.nextMigration.taskIndex = 0
        ShellString(JSON.stringify(this.settingsCached, null, 2)).to(this.settingsFilePath)
        console.log(`reset next migration to [0, 0]`)
    }

    increaseTaskIndex(): void {
        this.settingsCached.nextMigration.taskIndex++
        ShellString(JSON.stringify(this.settingsCached, null, 2)).to(this.settingsFilePath)
        console.log(`increase task index to ${this.settingsCached.nextMigration.taskIndex}`)
    }

    increaseBatchIndex(): void {
        this.settingsCached.nextMigration.taskIndex = 0
        this.settingsCached.nextMigration.batchIndex++
        ShellString(JSON.stringify(this.settingsCached, null, 2)).to(this.settingsFilePath)
        console.log(`increase batch index to ${this.settingsCached.nextMigration.batchIndex}`)
    }

    inSameLayer(): boolean {
        return this.getChainId(Layer.Layer1) === this.getChainId(Layer.Layer2)
    }

    getExternalContracts(layerType: Layer): ExternalContracts {
        return this.settingsCached.layers[layerType]!.externalContracts
    }

    getChainId(layerType: Layer): number {
        return this.settingsCached.layers[layerType]!.chainId
    }

    getNetwork(layerType: Layer): Network {
        return this.settingsCached.layers[layerType]!.network
    }

    isLocal(): boolean {
        return this.stage === "test"
    }
}
