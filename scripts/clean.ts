import { rm } from "shelljs"
import { asyncExec } from "./helper"

async function cleanContract() {
    await asyncExec("buidler clean")
    rm("-rf", "./types")
    rm("-rf", "./flattened")
    rm("./metadata/*")
    rm("./build/*")
}

cleanContract()
