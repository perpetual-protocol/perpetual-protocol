import originalConfig from "../hardhat.config"

const config = {
    ...originalConfig,
    typechain: {
        outDir: "types/truffle",
        target: "truffle-v5",
    },
}

export default config
