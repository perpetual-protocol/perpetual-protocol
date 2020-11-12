import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types"
import { ExecOptions } from "child_process"
import { Signer, Wallet } from "ethers"
import { resolve } from "path"
import { exec, mkdir, ShellString, test } from "shelljs"
import {
    HOMESTEAD_MNEMONIC,
    KOVAN_MNEMONIC,
    RINKEBY_MNEMONIC,
    ROPSTEN_MNEMONIC,
    SOKOL_MNEMONIC,
    XDAI_MNEMONIC,
} from "../constants"
import { EthereumMetadata, Network } from "./common"

export async function getSigner(bre: BuidlerRuntimeEnvironment): Promise<Signer> {
    const network = bre.buidlerArguments.network! as Network
    console.log(`getSigner:network=${network}`)
    if (network === "localhost") {
        const signers = await bre.ethers.getSigners()
        return signers[0]
    } else if (network === "ropsten") {
        return Wallet.fromMnemonic(ROPSTEN_MNEMONIC || "")
    } else if (network === "kovan") {
        return Wallet.fromMnemonic(KOVAN_MNEMONIC || "")
    } else if (network === "rinkeby") {
        return Wallet.fromMnemonic(RINKEBY_MNEMONIC || "")
    } else if (network === "homestead") {
        return Wallet.fromMnemonic(HOMESTEAD_MNEMONIC || "")
    } else if (network === "sokol") {
        return Wallet.fromMnemonic(SOKOL_MNEMONIC || "")
    } else if (network === "xdai") {
        return Wallet.fromMnemonic(XDAI_MNEMONIC || "")
    } else {
        throw new Error("network not found: " + network)
    }
}

export function getNpmBin(cwd?: string) {
    const options: { [key: string]: any } = { silent: true }
    if (cwd) {
        options.cwd = cwd
    }

    return exec("npm bin", options)
        .toString()
        .trim()
}

/**
 * Execute command in in local node_modules directory
 * @param commandAndArgs command with arguments
 */
export function asyncExec(commandAndArgs: string, options?: ExecOptions): Promise<string> {
    const [command, ...args] = commandAndArgs.split(" ")
    const cwd = options ? options.cwd : undefined
    const npmBin = resolve(getNpmBin(cwd), command)
    const realCommand = test("-e", npmBin) ? `${npmBin} ${args.join(" ")}` : commandAndArgs
    console.log(`> ${realCommand}`)
    return new Promise<string>((resolve, reject) => {
        const cb = (code: number, stdout: string, stderr: string) => {
            if (code !== 0) {
                reject(stderr)
            } else {
                resolve(stdout)
            }
        }

        if (options) {
            exec(realCommand, options, cb)
        } else {
            exec(realCommand, cb)
        }
    })
}

export function writeMetadata(metadata: EthereumMetadata) {
    // write metadata to:
    // - packages/contract/ethereum.json
    // - packages/contract/build/ethereum.json
    const buildDir = resolve("build")
    mkdir("-p", buildDir)
    ShellString(JSON.stringify(metadata, null, 2)).to(`./ethereum.json`)
    ShellString(JSON.stringify(metadata, null, 2)).to(`${buildDir}/ethereum.json`)
}
export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}
