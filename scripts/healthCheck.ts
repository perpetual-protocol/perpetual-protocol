import { Fragment, JsonFragment } from "@ethersproject/abi"
import { BigNumber, Contract, ethers, utils } from "ethers"
import fetch from "node-fetch"
import AmmArtifact from "../build/contracts/Amm.json"
import ClearingHouseArtifact from "../build/contracts/ClearingHouse.json"
import ERC20Artifact from "../build/contracts/ERC20.json"
import InsuranceFundArtifact from "../build/contracts/InsuranceFund.json"
import { Amm, ClearingHouse, ERC20Token, InsuranceFund } from "../types/ethers"

const USDC_DECIMALS = BigNumber.from("1000000")
const provider = new ethers.providers.JsonRpcProvider(
    "https://little-frosty-field.xdai.quiknode.pro/25b211172476a7b94f4d1083a740c4c2fc325b0e/",
)

// string | Array<Fragment | JsonFragment | string> | Interface;
function instance(address: string, abi: Array<string | Fragment | JsonFragment>): Contract {
    return new ethers.Contract(address, abi, provider) as Contract
}
async function healthCheck(): Promise<void> {
    const results = await fetch(`https://metadata.perp.exchange/production.json`)
    const json = await results.json()
    const layer2 = json["layers"]["layer2"]

    const usdc = instance(layer2["externalContracts"]["usdc"], ERC20Artifact.abi) as ERC20Token
    const arbitrageur = layer2["externalContracts"]["arbitrageur"]

    const ammETH = instance(layer2["contracts"]["ETHUSDC"]["address"], AmmArtifact.abi) as Amm
    const ammBTC = instance(layer2["contracts"]["BTCUSDC"]["address"], AmmArtifact.abi) as Amm
    const ammYFI = instance(layer2["contracts"]["YFIUSDC"]["address"], AmmArtifact.abi) as Amm
    const insuranceFund = instance(
        layer2["contracts"]["InsuranceFund"]["address"],
        InsuranceFundArtifact.abi,
    ) as InsuranceFund
    const clearingHouse = instance(
        layer2["contracts"]["ClearingHouse"]["address"],
        ClearingHouseArtifact.abi,
    ) as ClearingHouse

    console.log("========= address ============")
    console.log("insuranceFund", insuranceFund.address)
    console.log("clearingHouse", clearingHouse.address)

    const ethCap = await ammETH.getOpenInterestNotionalCap()
    const btcCap = await ammBTC.getOpenInterestNotionalCap()
    const yfiCap = await ammYFI.getOpenInterestNotionalCap()
    console.log(`ethCap=${ethCap.toString()}`)
    console.log(`btcCap=${btcCap.toString()}`)
    console.log(`yfiCap=${yfiCap.toString()}`)
    const ETHOpenInterest = await clearingHouse.openInterestNotionalMap(ammETH.address)
    console.log("open interest of ETH", utils.formatEther(ETHOpenInterest.toString()))
    const BTCOpenInterest = await clearingHouse.openInterestNotionalMap(ammBTC.address)
    console.log("open interest of BTC", utils.formatEther(BTCOpenInterest.toString()))
    const YFIOpenInterest = await clearingHouse.openInterestNotionalMap(ammYFI.address)
    console.log("open interest of YFI", utils.formatEther(YFIOpenInterest.toString()))

    console.log("========= balance ============")
    const balanceOfInsuranceFund = (await usdc.functions.balanceOf(insuranceFund.address))[0]
    const balanceOfClearingHouse = (await usdc.functions.balanceOf(clearingHouse.address))[0]
    const balanceOfArbitrageur = (await usdc.functions.balanceOf(arbitrageur))[0]
    console.log("balance of insuranceFund", balanceOfInsuranceFund.div(USDC_DECIMALS).toString(), "usd")
    console.log("balance of clearingHouse", balanceOfClearingHouse.div(USDC_DECIMALS).toString(), "usd")
    console.log("balance of arbitrageur", balanceOfArbitrageur.div(USDC_DECIMALS).toString(), "usd")

    console.log("========= misc ============")
}

if (require.main === module) {
    healthCheck()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error)
            process.exit(1)
        })
}
