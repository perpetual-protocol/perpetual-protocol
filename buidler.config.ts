import { TASK_COMPILE, TASK_COMPILE_GET_COMPILER_INPUT } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { task, usePlugin } from "@nomiclabs/buidler/config"
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
    ROPSTEN_MNEMONIC,
    ROPSTEN_URL,
    SOKOL_MNEMONIC,
    SOKOL_URL,
    SRC_DIR,
    XDAI_MNEMONIC,
    XDAI_URL,
} from "./constants"
import { TASK_DEPLOY_LAYER } from "./scripts/common"

usePlugin("@nomiclabs/buidler-truffle5")
usePlugin("@nomiclabs/buidler-ethers")
usePlugin("@nomiclabs/buidler-waffle")
usePlugin("@nomiclabs/buidler-etherscan")
usePlugin("@openzeppelin/buidler-upgrades")
usePlugin("solidity-coverage")

// need to write a open zeppelin's proxyResolver if using any deployProxy in test case
// https://github.com/cgewecke/eth-gas-reporter/blob/master/docs/advanced.md
usePlugin("buidler-gas-reporter")

task(TASK_COMPILE_GET_COMPILER_INPUT).setAction(async (_, env, runSuper) => {
    const input = await runSuper()
    if (env.network.name === "coverage") {
        input.settings.metadata.useLiteralContent = false
    }
    return input
})

task(TASK_DEPLOY_LAYER, "Deploy a layer")
    .addPositionalParam("stage", "Target stage of the deployment")
    .addPositionalParam("layer", "Target layer of the deployment")
    .addPositionalParam("batch", "Target batch of the deployment")
    .setAction(async ({ stage, layer, batch }, bre) => {
        // only load dependencies when deploy is in action
        // because it depends on built artifacts and creates circular dependencies
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { deployLayer } = require("./scripts/deploy-layer")

        await bre.run(TASK_COMPILE)
        await deployLayer(stage, layer, +batch, bre)
    })

// stop using `BuidlerConfig` type in order to add `gasReporter` key which is not in current typing
const config = {
    networks: {
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
    solc: {
        version: "0.6.9",
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "istanbul",
    },
    paths: {
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
