import { ethers, upgrades } from "@nomiclabs/buidler"
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

export class OzScript {
    private readonly contractLoader: OzContractLoader
    private readonly ozInitMethodName = "initialize"

    constructor(private readonly provider: any, readonly networkConfig: OzNetworkConfig) {
        this.contractLoader = setupLoader({
            provider, // either a web3 provider or a web3 instance
            defaultSender: networkConfig.txParams.from!, // optional
            defaultGas: GAS, // optional, defaults to 200 thousand
            defaultGasPrice: GAS_PRICE, // optional, defaults to 1 gigawei
        })
    }

    async deploy(contractAlias: string, contractFileName: string, args: any[]): Promise<string> {
        // deploy contract by open zeppelin cli
        // ozScript won't replace the existing one, we have to manually remove it before deploy new contract first time
        const contract = await ethers.getContractFactory(contractFileName)
        const instance = await upgrades.deployProxy(contract, args, {
            initializer: this.ozInitMethodName,
            unsafeAllowCustomTypes: true,
        })
        return instance.address
    }

    async upgrade(proxy: string, contractFileName: string): Promise<void> {
        const contract = await ethers.getContractFactory(contractFileName)
        await upgrades.upgradeProxy(proxy, contract, {
            unsafeAllowCustomTypes: true,
        })
    }

    getTruffleContractInstance<T>(contractName: string, address?: string): T {
        return this.contractLoader.truffle.fromArtifact(contractName, address) as T
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getWeb3ContractInstance(contractName: string, address?: string): any {
        return this.contractLoader.web3.fromArtifact(contractName, address)
    }
}
