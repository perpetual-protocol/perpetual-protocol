/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { ShellString } from "shelljs"
import { ExternalContracts, Layer, Network, Stage, SystemDeploySettings } from "../scripts/common"
import production from "./settings/production.json"
import staging from "./settings/staging.json"

export class SettingsDao {
    private settingsCached!: SystemDeploySettings
    constructor(private readonly stage: Stage) {
        switch (stage) {
            case "production":
                this.settingsCached = production as SystemDeploySettings
                break
            case "staging":
                this.settingsCached = staging as SystemDeploySettings
                break
            case "test":
                try {
                    this.settingsCached = require("./settings/test.json")
                } catch (e) {
                    this.settingsCached = {
                        layers: {
                            layer1: {
                                chainId: 31337,
                                network: "localhost",
                                version: "0",
                                externalContracts: {
                                    foundationGovernance: "0xa230A4f6F38D904C2eA1eE95d8b2b8b7350e3d79",
                                    ambBridgeOnEth: "0xD4075FB57fCf038bFc702c915Ef9592534bED5c1",
                                    multiTokenMediatorOnEth: "0x30F693708fc604A57F1958E3CFa059F902e6d4CB",
                                },
                            },
                            layer2: {
                                chainId: 31337,
                                network: "localhost",
                                version: "0",
                                externalContracts: {
                                    foundationGovernance: "0x44883405Eb9826448d3E8eCC25889C5941E79d9b",
                                    ambBridgeOnXDai: "0xc38D4991c951fE8BCE1a12bEef2046eF36b0FA4A",
                                    multiTokenMediatorOnXDai: "0xA34c65d76b997a824a5E384471bBa73b0013F5DA",
                                },
                            },
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
        return `./publish/settings/${this.stage}.json`
    }

    setVersion(layerType: Layer, n: number): void {
        this.settingsCached.layers[layerType]!.version = n.toString()
        ShellString(JSON.stringify(this.settingsCached, null, 2)).to(this.settingsFilePath)
    }

    getStage(): Stage {
        return this.stage
    }

    getSystemDeploySettings(): SystemDeploySettings {
        return this.settingsCached
    }

    getVersion(layerType: Layer): number {
        return Number(this.settingsCached.layers[layerType]!.version)
    }

    increaseVersion(layerType: Layer): void {
        const layer = this.settingsCached.layers[layerType]!
        const increased = Number(layer.version) + 1
        layer.version = increased.toString()
        ShellString(JSON.stringify(this.settingsCached, null, 2)).to(this.settingsFilePath)
        console.log(`increase ${this.stage}:${layerType} version to ${layer.version}`)
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

    isMainnet(): boolean {
        return this.stage === "production"
    }
}
