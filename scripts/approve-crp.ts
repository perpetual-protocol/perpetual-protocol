/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { buidlerArguments, web3 } from "@nomiclabs/buidler"
import ConfigurableRightsPool from "../build/contracts/ConfigurableRightsPool.json"
import ERC20Token from "../build/contracts/ERC20Token.json"
import { ExternalContracts } from "../publish/ExternalContracts"
import { MultiSigWalletContract } from "../types"
import { convertBalance, CRP_CONFIGS } from "./crp-helpers"

/* eslint-disable no-console */
async function main(): Promise<void> {
    // prepare contract dependencies
    const { network } = buidlerArguments
    const externalContracts = new ExternalContracts(network!)
    const perpToken = externalContracts.perp!
    const usdcToken = externalContracts.usdc!
    const crpPool = externalContracts.balancerPerpUsdcCrp!
    const MultiSigWallet = artifacts.require("MultiSigWallet") as MultiSigWalletContract
    const multisig = await MultiSigWallet.at(externalContracts.foundationMultisig!)
    const { Contract } = web3.eth
    const perpTokenInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ERC20Token.abi as unknown) as any[],
        perpToken,
    )
    const usdcTokenInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ERC20Token.abi as unknown) as any[],
        usdcToken,
    )
    const crpPoolInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ConfigurableRightsPool.abi as unknown) as any[],
        crpPool,
    )
    console.log(`crpPool=${crpPool}`)

    // approve perp token for crpPool
    const perpStartBalance = await convertBalance(CRP_CONFIGS.PERP_START_BALANCE, perpToken)
    const approvePerpEncodedData = perpTokenInstance.methods.approve(crpPool, perpStartBalance).encodeABI()
    console.log(`approve perp=${approvePerpEncodedData}`)
    const approvePerpTx = await multisig.submitTransaction(perpToken, 0, approvePerpEncodedData)
    console.log(`approve perp completed=${JSON.stringify(approvePerpTx)}`)

    // approve usdc token for crpPool
    const usdcStartBalance = await convertBalance(CRP_CONFIGS.USDC_START_BALANCE, usdcToken)
    const approveUsdcEncodedData = usdcTokenInstance.methods.approve(crpPool, usdcStartBalance).encodeABI()
    console.log(`approve usdc=${approveUsdcEncodedData}`)
    const approveUsdcTx = await multisig.submitTransaction(usdcToken, 0, approveUsdcEncodedData)
    console.log(`approve usdc completed=${JSON.stringify(approveUsdcTx)}`)

    // disable swap in the beginning
    const disableSwapEncodedData = crpPoolInstance.methods.setPublicSwap(false).encodeABI()
    console.log(`setPublicSwap to false=${disableSwapEncodedData}`)
    const disableSwapTx = await multisig.submitTransaction(crpPool, 0, disableSwapEncodedData)
    console.log(`setPublicSwap to false completed=${JSON.stringify(disableSwapTx)}`)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
