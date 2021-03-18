import { HardhatUserConfig } from "hardhat/types"
import { join } from "path"
import { ARTIFACTS_DIR, SRC_DIR_NAME } from "./constants"
import originalConfig from "./hardhat.config"
import { FLATTEN_BASE_DIR } from "./scripts/flatten"

const dirName = "Amm"

const config: HardhatUserConfig = {
    ...originalConfig,
    paths: {
        // source & artifacts does not work since we use openzeppelin-sdk for upgradable contract
        sources: join(FLATTEN_BASE_DIR, dirName, SRC_DIR_NAME),
        artifacts: join(FLATTEN_BASE_DIR, dirName, ARTIFACTS_DIR),
        tests: join(FLATTEN_BASE_DIR, dirName, "./tests"),
        cache: join(FLATTEN_BASE_DIR, dirName, "./cache"),
    },
}

export default config
