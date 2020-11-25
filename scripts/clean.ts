import { rm } from "shelljs"
import { asyncExec } from "./helper"

async function cleanContract() {
    await asyncExec("buidler clean")
    rm("-rf", "./types")
    rm("./system.json")
    rm("./build/system.json")
}

cleanContract()
