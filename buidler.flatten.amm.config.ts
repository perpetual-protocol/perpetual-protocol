import { join } from "path"
import originalConfig from "./buidler.config"
import { SRC_DIR_NAME } from "./constants"
import { FLATTEN_BASE_DIR } from "./scripts/flatten"

const dirName = "Amm"

const config = {
    ...originalConfig,
    paths: {
        // source & artifacts does not work since we use openzeppelin-sdk for upgradable contract
        sources: join(FLATTEN_BASE_DIR, dirName, SRC_DIR_NAME),
        artifacts: join(FLATTEN_BASE_DIR, dirName, originalConfig.paths.artifacts),
        tests: join(FLATTEN_BASE_DIR, dirName, "./tests"),
        cache: join(FLATTEN_BASE_DIR, dirName, "./cache"),
    },
}

export default config
