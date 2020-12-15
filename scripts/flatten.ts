import { join } from "path"
import { mkdir, ShellString } from "shelljs"
import { asyncExec } from "./helper"

export const FLATTEN_BASE_DIR = "./flattened"

export async function flatten(fromDir: string, toDir: string, filename: string): Promise<void> {
    let licenseDeclared = false
    let versionDeclared = false
    let abiV2Declared = false
    const fromFile = join(fromDir, filename)
    const toFile = join(toDir, filename)
    mkdir("-p", toDir)
    const flattened = await asyncExec(`truffle-flattener ${fromFile}`)
    console.log(flattened)
    const trimmed = flattened.split("\n").filter(line => {
        if (line.indexOf("SPDX-License-Identifier") !== -1) {
            if (!licenseDeclared) {
                licenseDeclared = true
                return true
            } else {
                return false
            }
        } else if (line.indexOf("pragma solidity") !== -1) {
            if (!versionDeclared) {
                versionDeclared = true
                return true
            } else {
                return false
            }
        } else if (line.indexOf("pragma experimental ABIEncoderV2") !== -1) {
            if (!abiV2Declared) {
                abiV2Declared = true
                return true
            } else {
                return false
            }
        } else {
            return true
        }
    })

    ShellString(trimmed.join("\n")).to(toFile)
}

if (require.main === module) {
    flatten("./src", "./flattened/src", "ClearingHouse.sol")
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
