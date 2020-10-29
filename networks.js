const {
    LOCALHOST_URL,
    GAS_PRICE,
    GAS,
    ROPSTEN_URL,
    ROPSTEN_MNEMONIC,
    KOVAN_URL,
    KOVAN_MNEMONIC,
    RINKEBY_URL,
    RINKEBY_MNEMONIC,
    HOMESTEAD_MNEMONIC,
    HOMESTEAD_URL,
    SOKOL_MNEMONIC,
    SOKOL_URL,
    XDAI_MNEMONIC,
    XDAI_URL,
} = require("./constants")
const HDWalletProvider = require("@truffle/hdwallet-provider")

/*eslint-disable */
module.exports = {
    networks: {
        localhost: {
            url: LOCALHOST_URL,
            gas: GAS,
            gasPrice: GAS_PRICE,
            networkId: "*",
        },
        ropsten: {
            provider: () => new HDWalletProvider(ROPSTEN_MNEMONIC, ROPSTEN_URL),
            gas: GAS,
            gasPrice: GAS_PRICE,
            networkId: 3,
        },
        kovan: {
            provider: () => new HDWalletProvider(KOVAN_MNEMONIC, KOVAN_URL),
            gas: GAS,
            gasPrice: GAS_PRICE,
            networkId: 42,
        },
        rinkeby: {
            provider: () => new HDWalletProvider(RINKEBY_MNEMONIC, RINKEBY_URL),
            gas: GAS,
            gasPrice: GAS_PRICE,
            networkId: 4,
        },
        homestead: {
            provider: () => new HDWalletProvider(HOMESTEAD_MNEMONIC, HOMESTEAD_URL),
            gas: GAS,
            gasPrice: GAS_PRICE,
            networkId: 1,
        },
        sokol: {
            provider: () => {
                return new HDWalletProvider(SOKOL_MNEMONIC, SOKOL_URL)
            },
            network_id: 77,
        },
        xdai: {
            provider: () => {
                return new HDWalletProvider(XDAI_MNEMONIC, XDAI_URL)
            },
            network_id: 100,
        },
    },
}
