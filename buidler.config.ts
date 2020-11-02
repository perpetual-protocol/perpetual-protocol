import { Web3HTTPProviderAdapter } from "@nomiclabs/buidler-web3/dist/web3-provider-adapter"
import { TASK_COMPILE, TASK_COMPILE_GET_COMPILER_INPUT } from "@nomiclabs/buidler/builtin-tasks/task-names"
import { extendEnvironment, task, usePlugin } from "@nomiclabs/buidler/config"
import { BUIDLEREVM_NETWORK_NAME } from "@nomiclabs/buidler/plugins"
import { HDAccountsConfig } from "@nomiclabs/buidler/types"
import HDWalletProvider from "@truffle/hdwallet-provider"
import Web3 from "web3"
import {
    ARTIFACTS_DIR,
    COVERAGE_URL,
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
    XDAI_MNEMONIC,
    XDAI_URL,
} from "./constants"
import { TASK_DEPLOY_LAYER } from "./scripts/common"

usePlugin("@nomiclabs/buidler-truffle5")
usePlugin("@nomiclabs/buidler-ethers")
usePlugin("@nomiclabs/buidler-waffle")
usePlugin("@openzeppelin/buidler-upgrades")
usePlugin("solidity-coverage")
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
        sources: "./src",
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
}

extendEnvironment(bre => {
    // when the target network is real, override buidler's own web3 provider with proper nonce-tracker support
    // so it doesn't raise "nonce is too low" errors (most commonly due to load-balanced endpoints)
    if (BUIDLEREVM_NETWORK_NAME !== bre.network.name && "localhost" !== bre.network.name) {
        console.log(`overriding web3 provider with nonce-tracker support for network: ${bre.network.name}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const overrideBre = bre as any
        overrideBre.web3 = new Web3(
            // HDWalletProvider implements the nonce-tracker that'll cache the current pending tx nonce locally,
            // so it is immune to endpoint load-balancing issues.
            new HDWalletProvider(
                // we assume the network config always has a mnemonic account defined
                (bre.network.config.accounts as HDAccountsConfig).mnemonic,
                // bre.network.provider is an EIP1193-compatible provider, but we still need to wrap it with
                // buidler's adapter in order for it to run properly under buidler env
                new Web3HTTPProviderAdapter(bre.network.provider),
            ),
        )
    }
})

export default config
