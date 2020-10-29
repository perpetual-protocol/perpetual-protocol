import { Contract } from "ethers"
import { providers } from "ethers"
import { utils } from "ethers"
import { join } from "path"
import { cat } from "shelljs"
import { paths } from "../../../scripts/common"
import { asyncExec } from "../../../scripts/helper"
import ClearingHouseArtifact from "../build/contracts/ClearingHouse.json"
import { ClearingHouse } from "../types/ethers/ClearingHouse"
import { devEvm } from "./dev"

async function testDeploy(): Promise<void> {
    await asyncExec("npm run build")
    const onDeployed = async (): Promise<boolean> => {
        // the reason we don't use es6 import statement on top of file
        // is it is empty until deployed, so the file need to be read here.
        const jsonFile = join(paths.packages, "contract", "build", "system.json")
        const systemMetadata = JSON.parse(cat(jsonFile))
        const provider = new providers.JsonRpcProvider("http://localhost:8545")
        const clearingHouse = (new Contract(
            systemMetadata.layers.layer2.contracts.ClearingHouse.address,
            ClearingHouseArtifact.abi,
            provider,
        ) as unknown) as ClearingHouse

        console.log(
            "deploy test success:\n" +
                `  - initMarginRatio: ${utils.formatEther(await clearingHouse.initMarginRatio())}\n` +
                `  - maintenanceMarginRatio: ${utils.formatEther(await clearingHouse.maintenanceMarginRatio())}\n` +
                `  - liquidationFeeRatio: ${utils.formatEther(await clearingHouse.liquidationFeeRatio())}`,
        )
        return false
    }

    await devEvm(onDeployed)
}

if (require.main === module) {
    testDeploy()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
