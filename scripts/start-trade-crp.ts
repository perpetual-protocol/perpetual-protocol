/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { buidlerArguments, web3 } from "@nomiclabs/buidler"
import ConfigurableRightsPool from "../build/contracts/ConfigurableRightsPool.json"
import { ExternalContracts } from "../publish/ExternalContracts"
import { MultiSigWalletContract } from "../types"

/* eslint-disable no-console */
async function main(): Promise<void> {
    // prepare contract dependencies
    const { network } = buidlerArguments
    const externalContracts = new ExternalContracts(network!)
    const MultiSigWallet = artifacts.require("MultiSigWallet") as MultiSigWalletContract
    const crpPool = externalContracts.balancerPerpUsdcCrp!
    const multisig = await MultiSigWallet.at(externalContracts.foundationMultisig!)
    const { Contract } = web3.eth
    const crpPoolInstance = new Contract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ConfigurableRightsPool.abi as unknown) as any[],
        crpPool,
    )

    // 4. when it's approaching startBlock, enable swap
    const enableSwapEncodedData = crpPoolInstance.methods.setPublicSwap(true).encodeABI()
    console.log(`setPublicSwap to true=${enableSwapEncodedData}`)
    const enableSwapTx = await multisig.submitTransaction(crpPool, 0, enableSwapEncodedData)
    console.log(`setPublicSwap to true completed=${enableSwapTx}`)
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
