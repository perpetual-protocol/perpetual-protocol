/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { buidlerArguments, web3 } from "@nomiclabs/buidler"
import ConfigurableRightsPool from "../build/contracts/ConfigurableRightsPool.json"
import { ExternalContracts } from "../publish/ExternalContracts"
import { MultiSigWalletContract } from "../types"

async function main(): Promise<void> {
    // prepare contract dependencies
    const { network } = buidlerArguments
    const externalContracts = new ExternalContracts(network!)
    const perpToken = externalContracts.perp!
    const usdcToken = externalContracts.usdc!
    const crpPool = externalContracts.balancerPerpUsdcCrp!
    const { Contract } = web3.eth
    const crpPoolInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ConfigurableRightsPool.abi as unknown) as any[],
        crpPool,
    )
    const MultiSigWallet = artifacts.require("MultiSigWallet") as MultiSigWalletContract
    const multisig = await MultiSigWallet.at(externalContracts.foundationMultisig!)

    // pause trade first
    const pauseSwapEncodedData = crpPoolInstance.methods.setPublicSwap(false).encodeABI()
    console.log(`setPublicSwap to false=${pauseSwapEncodedData}`)
    const pauseSwapTx = await multisig.submitTransaction(crpPool, 0, pauseSwapEncodedData)
    console.log(`setPublicSwap to false completed=${pauseSwapTx}`)

    // remove usdc
    const removeUsdcEncodedData = crpPoolInstance.methods.removeToken(usdcToken).encodeABI()
    console.log(`removeUsdcEncodedData=${removeUsdcEncodedData}`)
    const removeUsdcTx = await multisig.submitTransaction(crpPool, 0, removeUsdcEncodedData)
    console.log(`removeUsdcEncodedData completed=${removeUsdcTx}`)

    // remove perp
    const removePerpEncodedData = crpPoolInstance.methods.removeToken(perpToken).encodeABI()
    console.log(`removePerpEncodedData=${removePerpEncodedData}`)
    const removePerpEncodedTx = await multisig.submitTransaction(crpPool, 0, removePerpEncodedData)
    console.log(`removePerpEncodedData completed=${removePerpEncodedTx}`)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
