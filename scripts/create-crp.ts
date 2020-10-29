/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { buidlerArguments, web3 } from "@nomiclabs/buidler"
import ConfigurableRightsPool from "../build/contracts/ConfigurableRightsPool.json"
import { ExternalContracts } from "../publish/ExternalContracts"
import { MultiSigWalletContract } from "../types"
import { CRP_CONFIGS } from "./crp-helpers"

/* eslint-disable no-console */
async function main(): Promise<void> {
    // prepare contract dependencies
    const { network } = buidlerArguments
    const externalContracts = new ExternalContracts(network!)
    const crpPool = externalContracts.balancerPerpUsdcCrp!
    const MultiSigWallet = artifacts.require("MultiSigWallet") as MultiSigWalletContract
    const multisig = await MultiSigWallet.at(externalContracts.foundationMultisig!)
    const { Contract } = web3.eth
    const crpPoolInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ConfigurableRightsPool.abi as unknown) as any[],
        crpPool,
    )
    console.log(`crpPool=${crpPool}`)
    console.log(`FEE=${CRP_CONFIGS.SWAP_FEE}`)

    const createPoolEncodedData = crpPoolInstance.methods
        .createPool(
            CRP_CONFIGS.FUND_TOKEN_SUPPLY,
            CRP_CONFIGS.MIM_WEIGHTS_CHANGE_BLOCK,
            CRP_CONFIGS.ADD_TOKEN_TIME_LOCK_IN_BLOCK,
        )
        .encodeABI()
    console.log(`createPool=${createPoolEncodedData}`)
    const createPoolTx = await multisig.submitTransaction(crpPool, 0, createPoolEncodedData)
    console.log(`create pool completed=${createPoolTx}`)

    // setup end block
    const currentBlock = (await web3.eth.getBlock("latest")).number
    let startBlock = CRP_CONFIGS.START_BLOCK
    let endBlock = CRP_CONFIGS.END_BLOCK
    if (network !== "mainnet" && network !== "homestead") {
        // default block number is for mainnet only
        startBlock = currentBlock + 20
        endBlock = startBlock + 50
    }

    const endWeights = [CRP_CONFIGS.PERP_END_WEIGHT, CRP_CONFIGS.USDC_END_WEIGHT]
    console.log(
        `updateWeightsGradually=${JSON.stringify(
            endWeights,
        )}, start=${startBlock.toString()}, endBlock=${endBlock.toString()}`,
    )
    const updateWeightsGraduallyEncodedData = crpPoolInstance.methods
        .updateWeightsGradually(endWeights, startBlock, endBlock)
        .encodeABI()
    const updateWeightsGraduallyTx = await multisig.submitTransaction(crpPool, 0, updateWeightsGraduallyEncodedData)
    console.log(`updateWeightsCompleted=${updateWeightsGraduallyTx}`)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
