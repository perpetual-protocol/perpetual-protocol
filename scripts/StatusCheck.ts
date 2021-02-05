import { Fragment, JsonFragment } from "@ethersproject/abi"
import { Contract, ethers, utils } from "ethers"
import fetch from "node-fetch"
import AmmArtifact from "../build/contracts/Amm.json"
import ClearingHouseArtifact from "../build/contracts/ClearingHouse.json"
import ERC20Artifact from "../build/contracts/ERC20.json"
import InsuranceFundArtifact from "../build/contracts/InsuranceFund.json"
import { Amm, ClearingHouse, ERC20Token, InsuranceFund } from "../types/ethers"

const USDC_DECIMALS = 6
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
    const ammDOT = instance(layer2["contracts"]["DOTUSDC"]["address"], AmmArtifact.abi) as Amm
    const ammSNX = instance(layer2["contracts"]["SNXUSDC"]["address"], AmmArtifact.abi) as Amm
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
    const dotCap = await ammDOT.getOpenInterestNotionalCap()
    const snxCap = await ammSNX.getOpenInterestNotionalCap()
    console.log(`ethCap=${utils.formatEther(ethCap.toString())}`)
    console.log(`btcCap=${utils.formatEther(btcCap.toString())}`)
    console.log(`yfiCap=${utils.formatEther(yfiCap.toString())}`)
    console.log(`dotCap=${utils.formatEther(dotCap.toString())}`)
    console.log(`snxCap=${utils.formatEther(snxCap.toString())}`)
    const ETHOpenInterest = await clearingHouse.openInterestNotionalMap(ammETH.address)
    console.log("open interest of ETH", utils.formatEther(ETHOpenInterest.toString()))
    const BTCOpenInterest = await clearingHouse.openInterestNotionalMap(ammBTC.address)
    console.log("open interest of BTC", utils.formatEther(BTCOpenInterest.toString()))
    const YFIOpenInterest = await clearingHouse.openInterestNotionalMap(ammYFI.address)
    console.log("open interest of YFI", utils.formatEther(YFIOpenInterest.toString()))
    const DOTOpenInterest = await clearingHouse.openInterestNotionalMap(ammDOT.address)
    console.log("open interest of DOT", utils.formatEther(DOTOpenInterest.toString()))
    const SNXOpenInterest = await clearingHouse.openInterestNotionalMap(ammSNX.address)
    console.log("open interest of SNX", utils.formatEther(SNXOpenInterest.toString()))

    const ETHReserves = await ammETH.getReserve()
    console.log(
        `ETH Amm quote reserve=${utils.formatEther(
            ETHReserves[0].toString(),
        )}, ETH Amm base reserve=${utils.formatEther(ETHReserves[1].toString())}`,
    )
    const BTCReserves = await ammBTC.getReserve()
    console.log(
        `BTC Amm quote reserve=${utils.formatEther(
            BTCReserves[0].toString(),
        )}, BTC Amm base reserve=${utils.formatEther(BTCReserves[1].toString())}`,
    )
    const YFIReserves = await ammYFI.getReserve()
    console.log(
        `YFI Amm quote reserve=${utils.formatEther(
            YFIReserves[0].toString(),
        )}, YFI Amm base reserve=${utils.formatEther(YFIReserves[1].toString())}`,
    )
    const DOTReserves = await ammDOT.getReserve()
    console.log(
        `DOT Amm quote reserve=${utils.formatEther(
            DOTReserves[0].toString(),
        )}, DOT Amm base reserve=${utils.formatEther(DOTReserves[1].toString())}`,
    )
    const SNXReserves = await ammSNX.getReserve()
    console.log(
        `SNX Amm quote reserve=${utils.formatEther(
            SNXReserves[0].toString(),
        )}, SNX Amm base reserve=${utils.formatEther(SNXReserves[1].toString())}`,
    )

    console.log("========= balance ============")
    const balanceOfInsuranceFund = (await usdc.functions.balanceOf(insuranceFund.address))[0]
    const balanceOfClearingHouse = (await usdc.functions.balanceOf(clearingHouse.address))[0]
    const balanceOfArbitrageur = (await usdc.functions.balanceOf(arbitrageur))[0]
    console.log("balance of insuranceFund", utils.formatUnits(balanceOfInsuranceFund.toString(), USDC_DECIMALS), "usd")
    console.log("balance of clearingHouse", utils.formatUnits(balanceOfClearingHouse.toString(), USDC_DECIMALS), "usd")
    console.log("balance of arbitrageur", utils.formatUnits(balanceOfArbitrageur.toString(), USDC_DECIMALS), "usd")

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
