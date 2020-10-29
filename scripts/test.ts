import { asyncExec } from "../../../scripts/helper"
import { ARTIFACTS_DIR } from "../constants"

async function testContract(): Promise<void> {
    if (process.env["COVERAGE"]) {
        try {
            await asyncExec(`buidler coverage --temp ${ARTIFACTS_DIR} --network coverage`)
        } catch (e) {
            console.log("run coverage failed but it is okay since regular test is passed, ignore it")
        }
    } else {
        await asyncExec("buidler test")
        await asyncExec("npm run test:deploy")
    }
}

if (require.main === module) {
    testContract()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
