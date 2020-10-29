import { ExecOptions } from "child_process"
import { resolve } from "path"
import { exec, mkdir, ShellString, test } from "shelljs"
import { EthereumMetadata } from "./common"

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
