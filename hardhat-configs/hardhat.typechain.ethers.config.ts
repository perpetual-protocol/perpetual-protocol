import originalConfig from "../hardhat.config"

const config = {
    ...originalConfig,
    typechain: {
        outDir: "types/ethers",
        target: "ethers-v5",
    },
}

export default config
