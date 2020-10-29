/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { buidlerArguments, web3 } from "@nomiclabs/buidler"
import BN from "bn.js"
import prompts from "prompts"
import ConfigurableRightsPoolArtifact from "../build/contracts/ConfigurableRightsPool.json"
import CRPFactoryArtifact from "../build/contracts/CRPFactory.json"
import ERC20Artifact from "../build/contracts/ERC20.json"
import MultiSigWalletArtifact from "../build/contracts/MultiSigWallet.json"
import { ExternalContracts } from "../publish/ExternalContracts"
import { MultiSigWalletContract, MultiSigWalletInstance } from "../types"
import { TransactionObject } from "../types/web3/types"
import { convertBalance, CRP_CONFIGS } from "./crp-helpers"
import { getFromAccount } from "./deploy"

export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function processMultiSigTransaction(
    txId: string,
    multisig: MultiSigWalletInstance,
    destAddr: string,
    value: number | BN | string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: TransactionObject<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    methodInputAbi: any,
): Promise<void> {
    const txData = tx.encodeABI()
    console.log(`[${txId}] submit Data=${txData}`)
    const submitTx = await multisig.submitTransaction(destAddr, value, txData)
    console.log(`[${txId}] submit completed at txHash=${submitTx.tx}`)

    // wait for the tx to be available for query
    let submissionTx
    // eslint-disable-next-line no-constant-condition
    while (true) {
        submissionTx = await web3.eth.getTransaction(submitTx.tx)
        if (submissionTx) {
            break
        } else {
            await sleep(1000)
        }
    }

    // visual verify parameters by decoding the submit tx data retroactively
    const decodedSubmissionInput = web3.eth.abi.decodeParameters(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        MultiSigWalletArtifact.abi.find(item => item.name === "submitTransaction")!.inputs,
        "0x" + submissionTx.input.slice(10),
    )
    const decodedSubmissionPayload = web3.eth.abi.decodeParameters(
        methodInputAbi,
        "0x" + decodedSubmissionInput.data.slice(10),
    )
    console.log(`[${txId}] data:`, decodedSubmissionPayload)
    console.log(`[${txId}] destination:`, decodedSubmissionInput.destination)
    console.log(`[${txId}] value:`, decodedSubmissionInput.value)
    console.log(`[${txId}] submission ID: ${submitTx.logs[0].args.transactionId}`)
    console.log(
        `[${txId}] estimated gas to confirm multisig transaction=${await tx.estimateGas({ from: multisig.address })}`,
    )
    console.log(`[${txId}] please verify the above submission and confirm it in Gnosis safe`)
}

/* eslint-disable no-console */
async function main(): Promise<void> {
    // prepare contract dependencies
    const { network } = buidlerArguments
    const { Contract } = web3.eth

    const externalContracts = new ExternalContracts(network!)
    const perpToken = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ERC20Artifact.abi as unknown) as any[],
        externalContracts.perp!,
    )
    const usdcToken = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ERC20Artifact.abi as unknown) as any[],
        externalContracts.usdc!,
    )
    const balancerPoolFactory = externalContracts.balancerPoolFactory!
    const MultiSigWallet = artifacts.require("MultiSigWallet") as MultiSigWalletContract
    const multisig = await MultiSigWallet.at(externalContracts.foundationMultisig!)
    const balancerCrpFactory = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (CRPFactoryArtifact.abi as unknown) as any[],
        externalContracts.balancerCrpFactory!,
    )
    console.log(
        `perp=${perpToken.options.address}, usdc=${usdcToken.options.address}, multisig=${multisig.address}, balancerCrpFactory=${balancerCrpFactory.options.address}, balancerPoolFactory=${balancerPoolFactory}`,
    )
    const from = await getFromAccount()
    console.log(`from=${from}`)

    // 1. deploy balancer crp pool
    const perpStartBalance = await convertBalance(CRP_CONFIGS.PERP_START_BALANCE, perpToken.options.address)
    const usdcStartBalance = await convertBalance(CRP_CONFIGS.USDC_START_BALANCE, usdcToken.options.address)
    console.log(`start balances: perp=${perpStartBalance}, usdc=${usdcStartBalance}`)

    console.log(`create new crp...`)
    await processMultiSigTransaction(
        "crpFactory.newCrp",
        multisig,
        balancerCrpFactory.options.address,
        0,
        balancerCrpFactory.methods.newCrp(
            balancerPoolFactory,
            [
                CRP_CONFIGS.SYMBOL,
                CRP_CONFIGS.SYMBOL,
                [perpToken.options.address, usdcToken.options.address],
                [perpStartBalance, usdcStartBalance],
                [CRP_CONFIGS.PERP_START_WEIGHT, CRP_CONFIGS.USDC_START_WEIGHT],
                CRP_CONFIGS.SWAP_FEE,
            ],
            [
                CRP_CONFIGS.PERMISSIONS.canPauseSwapping,
                CRP_CONFIGS.PERMISSIONS.canChangeSwapFee,
                CRP_CONFIGS.PERMISSIONS.canChangeWeights,
                CRP_CONFIGS.PERMISSIONS.canAddRemoveTokens,
                CRP_CONFIGS.PERMISSIONS.canWhitelistLPs,
                CRP_CONFIGS.PERMISSIONS.canChangeCap,
            ],
        ),
        CRPFactoryArtifact.abi.find(item => item.name === "newCrp")!.inputs,
    )

    const crpPoolAddrResponse = await prompts({
        type: "text",
        name: "address",
        message: "what's the address of the new CRP pool?",
        validate: address => (address.startsWith("0x") ? true : "address should begin with 0x"),
    })

    const crpPool = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ConfigurableRightsPoolArtifact.abi as unknown) as any[],
        crpPoolAddrResponse.address,
    )
    console.log(`crpPool=${crpPool.options.address}`)

    // 2. approve initial funds
    console.log("approve perp and usdc...")
    const approvePerpTokenTx = perpToken.methods.approve(crpPool.options.address, perpStartBalance)
    const approveUsdcTokenTx = usdcToken.methods.approve(crpPool.options.address, usdcStartBalance)
    const approveErc20TokenInputAbi = ERC20Artifact.abi.find(item => item.name === "approve")!.inputs
    await processMultiSigTransaction(
        "approvePerp",
        multisig,
        perpToken.options.address,
        0,
        approvePerpTokenTx,
        approveErc20TokenInputAbi,
    )
    await processMultiSigTransaction(
        "approveUsdc",
        multisig,
        usdcToken.options.address,
        0,
        approveUsdcTokenTx,
        approveErc20TokenInputAbi,
    )

    // prompt the user to verify execution
    await prompts({
        type: "text",
        name: "answer",
        message: "have you confirm & verify the execution?",
        validate: answer => (answer === "y" ? true : "please verify the execution before continue"),
    })

    // 3. create pool
    console.log("crpPool.createPool...")
    await processMultiSigTransaction(
        "crpPool.createPool",
        multisig,
        crpPool.options.address,
        0,
        crpPool.methods.createPool(
            CRP_CONFIGS.FUND_TOKEN_SUPPLY,
            CRP_CONFIGS.MIM_WEIGHTS_CHANGE_BLOCK,
            CRP_CONFIGS.ADD_TOKEN_TIME_LOCK_IN_BLOCK,
        ),
        ConfigurableRightsPoolArtifact.abi.find(item => item.name === "createPool")!.inputs,
    )

    // prompt the user to verify execution
    await prompts({
        type: "text",
        name: "answer",
        message: "have you confirm & verify the execution?",
        validate: answer => (answer === "y" ? true : "please verify the execution before continue"),
    })

    // 4. disable trade & approve tokens for crp pool
    console.log("disable crp swap...")
    await processMultiSigTransaction(
        "crpPool.setPublicSwap",
        multisig,
        crpPool.options.address,
        0,
        crpPool.methods.setPublicSwap(false),
        ConfigurableRightsPoolArtifact.abi.find(item => item.name === "setPublicSwap")!.inputs,
    )

    // prompt the user to verify execution
    await prompts({
        type: "text",
        name: "answer",
        message: "have you confirm & verify the execution?",
        validate: answer => (answer === "y" ? true : "please verify the execution before continue"),
    })

    // 5. update weights gradually
    // setup parameters
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
        `update weights gradually, endWeights=${JSON.stringify(
            endWeights,
        )}, start=${startBlock.toString()}, endBlock=${endBlock.toString()}`,
    )
    await processMultiSigTransaction(
        "crpPool.updateWeightsGradually",
        multisig,
        crpPool.options.address,
        0,
        crpPool.methods.updateWeightsGradually(endWeights, startBlock, endBlock),
        ConfigurableRightsPoolArtifact.abi.find(item => item.name === "updateWeightsGradually")!.inputs,
    )

    // prompt the user to verify execution
    await prompts({
        type: "text",
        name: "answer",
        message: "have you confirm & verify the execution?",
        validate: answer => (answer === "y" ? true : "please verify the execution before continue"),
    })
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
