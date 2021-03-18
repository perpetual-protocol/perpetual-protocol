import originalConfig from "../hardhat.config"

const config = {
    ...originalConfig,
    typechain: {
        outDir: "types/web3",
        target: "web3-v1",
    },
}

export default config
