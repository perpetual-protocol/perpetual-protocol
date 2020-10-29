import { rm } from "shelljs"
import { paths } from "../../../scripts/common"
import { asyncExec } from "../../../scripts/helper"

async function cleanContract() {
    await asyncExec("buidler clean")
    rm("-rf", `${paths.packages}/contract/types`)
    rm(`${paths.packages}/contract/ethereum.json`)
    rm(`${paths.packages}/contract/build/ethereum.json`)
}

cleanContract()
