import { setupLoader, TruffleLoader, Web3Loader } from "@openzeppelin/contract-loader"
import { TxParams } from "@openzeppelin/upgrades"
import { GAS, GAS_PRICE } from "../constants"

export interface OzNetworkConfig {
    network: string
    txParams: TxParams
}

export interface OzContractLoader {
    web3: Web3Loader
    truffle: TruffleLoader
}

// @openzeppelin/contractLoader wrapper
// remove once change to ether instance
// a workaround to access truffle instance
// `artificat.require(stringVariable)` works but `artificat.require(stringVariable)` fails
export class OzScript {
    private readonly contractLoader: OzContractLoader

    constructor(provider: any, readonly sender: string) {
        this.contractLoader = setupLoader({
            provider, // either a web3 provider or a web3 instance
            defaultSender: sender, // optional
            defaultGas: GAS, // optional, defaults to 200 thousand
            defaultGasPrice: GAS_PRICE, // optional, defaults to 1 gigawei
        })
    }

    getTruffleContractInstance<T>(contractName: string, address?: string): T {
        return this.contractLoader.truffle.fromArtifact(contractName, address) as T
    }
}
