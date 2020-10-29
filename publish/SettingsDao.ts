/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import { ShellString } from "shelljs"
import production from "./settings/production.json"
import staging from "./settings/staging.json"
import test from "./settings/test.json"
import { Stage, Layer, SystemDeploySettings, ExternalContracts, Network } from "../scripts/common"

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
                this.settingsCached = test as SystemDeploySettings
                break
            default:
                throw new Error(`Stage not found=${stage}`)
                break
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
