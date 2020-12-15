import { Fragment, JsonFragment } from "@ethersproject/abi"
import { BigNumber, Contract, ethers, utils } from "ethers"
import fetch from "node-fetch"
import yargs from "yargs"
import AmmArtifact from "../build/contracts/Amm.json"
import ClearingHouseArtifact from "../build/contracts/ClearingHouse.json"
import ERC20Artifact from "../build/contracts/ERC20.json"
import InsuranceFundArtifact from "../build/contracts/InsuranceFund.json"
import { Amm, ClearingHouse, ERC20Token, InsuranceFund } from "../types/ethers"

const DECIMAL_BETWEEN_ETH_USDC = BigNumber.from(1e12)
const provider = new ethers.providers.JsonRpcProvider("https://rpc.xdaichain.com/")

interface Argv {
    interval: number
}

function getArgv(): Argv {
    return yargs.options({
        interval: { type: "number", default: 5 },
    }).argv
}

function instance(address: string, abi: Array<string | Fragment | JsonFragment>): Contract {
    return new ethers.Contract(address, abi, provider) as Contract
}

async function printAmmInfo(amm: Amm, clearingHouse: ClearingHouse): Promise<void> {
    const personalCap = await amm.getMaxHoldingBaseAsset()
    const marketCap = await amm.getOpenInterestNotionalCap()
    const liquidityLen = await amm.getLiquidityHistoryLength()
    console.log(
        "( personal cap:",
        utils.formatEther(personalCap.toString()),
        ", market cap:",
        utils.formatEther(marketCap.toString()),
        ", curve@",
        liquidityLen.toString(),
        ")",
    )

    const reserve = await amm.getReserve()
    console.log(
        "quote reserve:",
        utils.formatEther(reserve[0].d.toString()),
        "base reserve:",
        utils.formatEther(reserve[1].d.toString()),
        "price:",
        reserve[0].d.div(reserve[1].d).toString(),
    )

    const cumulativeNotional = await amm.getCumulativeNotional()
    const totalPosition = await amm.totalPositionSize()
    console.log(
        "cumulative notional:",
        utils.formatEther(cumulativeNotional.toString()),
        ", totalPosition:",
        utils.formatEther(totalPosition.toString()),
    )

    const openInterest = await clearingHouse.openInterestNotionalMap(amm.address)
    console.log("open interest:", utils.formatEther(openInterest.toString()))
    const cumulativePremiumFraction = await clearingHouse.getLatestCumulativePremiumFraction(amm.address)
    console.log("cumulative premium:", utils.formatEther(cumulativePremiumFraction.toString()))

    const fundingRate = await amm.fundingRate()
    console.log("fundingRate:", utils.formatEther(fundingRate.mul("100").toString()), "%")
    console.log()
}

async function printStatus(json: any): Promise<void> {
    const contract = json["layers"]["layer2"]["contracts"]
    const external = json["layers"]["layer2"]["externalContracts"]

    const blockNumber = await provider.getBlockNumber()
    console.log(">>>>>>>>>>>>", blockNumber)

    //
    // get addresses
    //
    const usdc = instance(external["usdc"], ERC20Artifact.abi) as ERC20Token
    const arbitrageur = external["arbitrageur"]

    const ammETH = instance(contract["ETHUSDC"]["address"], AmmArtifact.abi) as Amm
    const ammBTC = instance(contract["BTCUSDC"]["address"], AmmArtifact.abi) as Amm
    const insuranceFund = instance(contract["InsuranceFund"]["address"], InsuranceFundArtifact.abi) as InsuranceFund
    const clearingHouse = instance(contract["ClearingHouse"]["address"], ClearingHouseArtifact.abi) as ClearingHouse

    //
    // Info
    //
    console.log("========= address ============")
    console.log("insuranceFund", insuranceFund.address)
    console.log("clearingHouse", clearingHouse.address)
    console.log("Amm ETH", ammETH.address)
    console.log("Amm BTC", ammBTC.address)
    console.log()

    console.log("========= ETH market Info ============")
    await printAmmInfo(ammETH, clearingHouse)

    console.log("========= BTC market Info ============")
    await printAmmInfo(ammBTC, clearingHouse)

    console.log("========= balance ============")
    const balanceOfInsuranceFund = (await usdc.functions.balanceOf(insuranceFund.address))[0]
    const balanceOfClearingHouse = (await usdc.functions.balanceOf(clearingHouse.address))[0]
    const balanceOfArbitrageur = (await usdc.functions.balanceOf(arbitrageur))[0]
    const ethBalanceOfArbitrageur = await provider.getBalance(arbitrageur)

    await balanceLog("insuranceFund", balanceOfInsuranceFund)
    await balanceLog("clearingHouse", balanceOfClearingHouse)
    await balanceLog("arbitrageur", balanceOfArbitrageur)
    console.log("arbitrageur eth", utils.formatEther(ethBalanceOfArbitrageur.toString()), "eth")

    console.log()
}

async function balanceLog(msg: string, value: BigNumber): Promise<void> {
    if (value <= BigNumber.from(0)) {
        console.log(
            msg,
            "\x1b[31m",
            utils.formatEther(value.mul(DECIMAL_BETWEEN_ETH_USDC).toString()),
            "\x1b[0m",
            "usd",
        )
    } else {
        console.log(msg, utils.formatEther(value.mul(DECIMAL_BETWEEN_ETH_USDC).toString()), "usd")
    }
}

async function healthCheck(stag: string, argv: Argv): Promise<void> {
    const url = `https://metadata.perp.exchange/${stag}.json`
    console.log("fetch from:", url)
    const results = await fetch(url)
    const json = await results.json()

    printStatus(json)
    setInterval(printStatus, argv.interval * 60 * 1000, json)
}

if (require.main === module) {
    const stage = process.argv[2] || "production"
    const argv: Argv = getArgv()

    healthCheck(stage, argv)
}
