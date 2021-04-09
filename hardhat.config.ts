import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-truffle5"
import "@nomiclabs/hardhat-waffle"
import "@openzeppelin/hardhat-upgrades"
import "@typechain/hardhat"
// need to write a open zeppelin's proxyResolver if using any deployProxy in test case
// https://github.com/cgewecke/eth-gas-reporter/blob/master/docs/advanced.md
import "hardhat-gas-reporter"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { HardhatUserConfig, task } from "hardhat/config"
import "solidity-coverage"
import {
    ARTIFACTS_DIR,
    COVERAGE_URL,
    ETHERSCAN_API_KEY,
    GAS_PRICE,
    HOMESTEAD_MNEMONIC,
    HOMESTEAD_URL,
    KOVAN_MNEMONIC,
    KOVAN_URL,
    RINKEBY_MNEMONIC,
    RINKEBY_URL,
    ROOT_DIR,
    ROPSTEN_MNEMONIC,
    ROPSTEN_URL,
    SOKOL_MNEMONIC,
    SOKOL_URL,
    SRC_DIR,
    XDAI_MNEMONIC,
    XDAI_URL,
} from "./constants"
import { TASK_CHECK_CHAINLINK, TASK_MIGRATE, TASK_SIMULATE } from "./scripts/common"

task(TASK_CHECK_CHAINLINK, "Check Chainlink")
    .addParam("address", "a Chainlink aggregator address")
    .setAction(async ({ address }, hre) => {
        await hre.run(TASK_COMPILE)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { checkChainlink } = require("./publish/check-chainlink")
        await checkChainlink(address, hre)
    })

task(TASK_SIMULATE, "Execute migration on mainnet fork node")
    .addParam("fork", "The URL of the JSON-RPC server to fork from")
    .addPositionalParam("migrationPath", "Target migration")
    .setAction(async ({ fork: forkTarget, migrationPath }, hre) => {
        // TODO: better way to ensure not running on real network?
        if (hre.network.name !== "hardhat") {
            throw new Error(`You should only run this on the "hardhat" network`)
        }

        // reset "hardhat" network to fork from specified target
        await hre.network.provider.request({
            method: "hardhat_reset",
            params: [
                {
                    forking: {
                        jsonRpcUrl: forkTarget,
                        // blockNumber: 11095000,
                    },
                },
            ],
        })

        await hre.run(TASK_MIGRATE, { stage: "test", migrationPath })
    })

task(TASK_MIGRATE, "Migrate contract deployment")
    .addPositionalParam("stage", "Target stage of the deployment")
    .addPositionalParam("migrationPath", "Target migration")
    .setAction(async ({ stage, migrationPath }, hre) => {
        // only load dependencies when deploy is in action
        // because it depends on built artifacts and creates circular dependencies
        const { migrate } = await import("./publish/Migration")

        await hre.run(TASK_COMPILE)
        await migrate(stage, migrationPath, hre)
    })

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
        },
        coverage: {
            url: COVERAGE_URL,
        },
        ropsten: {
            url: ROPSTEN_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: ROPSTEN_MNEMONIC,
            },
        },
        kovan: {
            url: KOVAN_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: KOVAN_MNEMONIC,
            },
        },
        rinkeby: {
            url: RINKEBY_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: RINKEBY_MNEMONIC,
            },
        },
        homestead: {
            url: HOMESTEAD_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: HOMESTEAD_MNEMONIC,
            },
        },
        sokol: {
            url: SOKOL_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: SOKOL_MNEMONIC,
            },
        },
        xdai: {
            url: XDAI_URL,
            gasPrice: GAS_PRICE,
            accounts: {
                mnemonic: XDAI_MNEMONIC,
            },
        },
    },
    solidity: {
        version: "0.6.9",
        settings: {
            optimizer: { enabled: true, runs: 200 },
            evmVersion: "istanbul",
        },
    },
    paths: {
        root: ROOT_DIR,
        // source & artifacts does not work since we use openzeppelin-sdk for upgradable contract
        sources: SRC_DIR,
        artifacts: ARTIFACTS_DIR,
        tests: "./tests",
        cache: "./cache",
    },
    mocha: {
        timeout: 60000,
    },
    gasReporter: {
        src: "src", // Folder in root directory to begin search for .sol file
        currency: "USD", // gasPrice based on current ethGasStation API
        coinmarketcap: process.env.CMC_API_KEY, // optional
    },
    etherscan: {
        // Your API key for Etherscan
        // Obtain one at https://etherscan.io/
        apiKey: ETHERSCAN_API_KEY,
    },
}

export default config
