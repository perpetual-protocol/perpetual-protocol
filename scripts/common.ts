// all lower-case, no dash; otherwise AWS deployment might fail
export type Stage = "production" | "staging" | "test"
export type Network = "homestead" | "rinkeby" | "ropsten" | "kovan" | "xdai" | "sokol" | "localhost"
export type Layer = "layer1" | "layer2"

// openzeppelin can't recognize xdai network
// so we use this this to map the network to openzeppelin config json file name
export const ozNetworkFile: Record<Network, string> = {
    homestead: "mainnet",
    rinkeby: "rinkeby",
    kovan: "kovan",
    ropsten: "ropsten",
    localhost: "unknown-31337",
    xdai: "unknown-100",
    sokol: "unknown-77",
}

// TODO deprecated
export enum DeployMode {
    Init = "init",
    Upgrade = "upgrade",
}

export interface ContractMetadata {
    name: string
    address: string
}

export interface AccountMetadata {
    privateKey: string
    balance: string
}

export interface EthereumMetadata {
    contracts: Record<string, ContractMetadata>
    accounts: AccountMetadata[]
    network: Network
}

export interface LayerMetadata extends EthereumMetadata {
    externalContracts: ExternalContracts
}

export interface SystemMetadata {
    layers: {
        [key in Layer]?: LayerMetadata
    }
}

export interface ExternalContracts {
    // default is gnosis multisig safe which plays the governance role
    foundationGovernance?: string
    arbitrageur?: string
    testnetFaucet?: string

    // https://docs.tokenbridge.net/eth-xdai-amb-bridge/about-the-eth-xdai-amb
    ambBridgeOnXDai?: string
    ambBridgeOnEth?: string

    // https://docs.tokenbridge.net/eth-xdai-amb-bridge/multi-token-extension#omnibridge-technical-information-and-extension-parameters
    multiTokenMediatorOnXDai?: string
    multiTokenMediatorOnEth?: string

    // https://blockscout.com/poa/xdai/bridged-tokens (if it's in xdai)
    tether?: string
    usdc?: string
    perp?: string

    // https://docs.openzeppelin.com/upgrades/2.8/api#ProxyAdmin
    proxyAdmin?: string
}

export interface LayerDeploySettings {
    chainId: number
    network: Network
    externalContracts: ExternalContracts
    version: string
}

export interface SystemDeploySettings {
    layers: {
        [key in Layer]?: LayerDeploySettings
    }
}

export const TASK_DEPLOY_LAYER = "deploy:layer"
