import dotenv from "dotenv"
import { join, resolve } from "path"
dotenv.config({ path: resolve(__dirname, "..", "..", ".env") })

export const ROOT_DIR = __dirname
export const SRC_DIR_NAME = "src"
const LEGACY_SRC_DIR_NAME = join(SRC_DIR_NAME, "legacy")

export const COVERAGE_URL = "http://127.0.0.1:8555"
export const LOCALHOST_URL = "http://127.0.0.1:8545"
export const ROPSTEN_URL = `${process.env["WEB3_ENDPOINT"]}`
export const KOVAN_URL = `${process.env["WEB3_KOVAN_ENDPOINT"]}`
export const RINKEBY_URL = `${process.env["WEB3_RINKEBY_ENDPOINT"]}`
export const HOMESTEAD_URL = `${process.env["WEB3_HOMESTEAD_ENDPOINT"]}`
export const SOKOL_URL = `${process.env["WEB3_SOKOL_ENDPOINT"]}`
export const XDAI_URL = `${process.env["WEB3_XDAI_ENDPOINT"]}`
export const RINKEBY_ARCHIVE_NODE_URL = `${process.env["ALCHEMY_RINKEBY_ENDPOINT"]}`
export const HOMESTEAD_ARCHIVE_NODE_URL = `${process.env["ALCHEMY_HOMESTEAD_ENDPOINT"]}`
export const XDAI_ARCHIVE_NODE_URL = "https://xdai-archive.blockscout.com"
export const ROPSTEN_MNEMONIC = process.env["ROPSTEN_MNEMONIC"] || ""
export const KOVAN_MNEMONIC = process.env["KOVAN_MNEMONIC"] || ""
export const RINKEBY_MNEMONIC = process.env["RINKEBY_MNEMONIC"] || ""
export const HOMESTEAD_MNEMONIC = process.env["HOMESTEAD_MNEMONIC"] || ""
export const SOKOL_MNEMONIC = process.env["SOKOL_MNEMONIC"] || ""
export const XDAI_MNEMONIC = process.env["XDAI_MNEMONIC"] || ""
export const ARTIFACTS_DIR = "./build/contracts"
export const GAS = 8000000
export const GAS_PRICE = 2_000_000_000
export const SRC_DIR = join(ROOT_DIR, SRC_DIR_NAME)
export const LEGACY_SRC_DIR = join(ROOT_DIR, LEGACY_SRC_DIR_NAME)
export const ETHERSCAN_API_KEY = process.env["ETHERSCAN_API_KEY"] || ""
