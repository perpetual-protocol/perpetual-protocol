const dotenv = require("dotenv")
const { resolve, join } = require("path")
dotenv.config({ path: resolve(__dirname, "..", "..", ".env") })

const ROOT_DIR = __dirname
const SRC_DIR_NAME = "src"
const LEGACY_SRC_DIR_NAME = join(SRC_DIR_NAME, "legacy")

module.exports = {
    COVERAGE_URL: "http://127.0.0.1:8555",
    LOCALHOST_URL: "http://127.0.0.1:8545",
    ROPSTEN_URL: `${process.env["WEB3_ENDPOINT"]}`,
    KOVAN_URL: `${process.env["WEB3_KOVAN_ENDPOINT"]}`,
    RINKEBY_URL: `${process.env["WEB3_RINKEBY_ENDPOINT"]}`,
    HOMESTEAD_URL: `${process.env["WEB3_HOMESTEAD_ENDPOINT"]}`,
    SOKOL_URL: `${process.env["WEB3_SOKOL_ENDPOINT"]}`,
    XDAI_URL: `${process.env["WEB3_XDAI_ENDPOINT"]}`,
    ROPSTEN_MNEMONIC: process.env["ROPSTEN_MNEMONIC"] || "",
    KOVAN_MNEMONIC: process.env["KOVAN_MNEMONIC"] || "",
    RINKEBY_MNEMONIC: process.env["RINKEBY_MNEMONIC"] || "",
    HOMESTEAD_MNEMONIC: process.env["HOMESTEAD_MNEMONIC"] || "",
    SOKOL_MNEMONIC: process.env["SOKOL_MNEMONIC"] || "",
    XDAI_MNEMONIC: process.env["XDAI_MNEMONIC"] || "",
    ARTIFACTS_DIR: "./build/contracts",
    GAS: 8000000,
    GAS_PRICE: 2_000_000_000,
    ROOT_DIR,
    SRC_DIR_NAME,
    SRC_DIR: join(ROOT_DIR, SRC_DIR_NAME),
    LEGACY_SRC_DIR: join(ROOT_DIR, LEGACY_SRC_DIR_NAME),
    ETHERSCAN_API_KEY: process.env["ETHERSCAN_API_KEY"] || "",
}
