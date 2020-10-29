import { rm } from "shelljs"
import { asyncExec } from "../../../scripts/helper"

async function cleanContract() {
    await asyncExec("buidler clean")
    rm("-rf", "./contract/types")
    rm("./contract/ethereum.json")
    rm("./contract/build/ethereum.json")
}

cleanContract()
