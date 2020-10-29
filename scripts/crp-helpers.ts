/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { web3 } from "@nomiclabs/buidler"
import BN from "bn.js"
import { ERC20TokenContract, ERC20TokenInstance } from "../types"

function toWei(number: string): string {
    return web3.utils.toWei(number)
}

function toDecimals(number: BN, decimals: BN): string {
    return number.mul(new BN("10").pow(new BN(decimals))).toString()
}

//
// Balancer LBP Config
//
// IF THERE'S ANY TOKEN ARRAY AS ARGUMENT, PERP ALWAYS FIRST
export const CRP_CONFIGS = {
    // around @September 9, at 6:00 am UTC & 3 days after
    START_BLOCK: 10825600,
    END_BLOCK: 10846450,
    // 7.5M PERP
    PERP_START_BALANCE: new BN("7500000"),
    // 1.33M USDC
    USDC_START_BALANCE: new BN("1333333"),
    PERP_START_WEIGHT: toWei("9"),
    USDC_START_WEIGHT: toWei("1"),
    PERP_END_WEIGHT: toWei("3"),
    USDC_END_WEIGHT: toWei("7"),
    SWAP_FEE: (10 ** 14).toString(),
    SYMBOL: "PERPUSDC",
    PERMISSIONS: {
        canPauseSwapping: true,
        canChangeSwapFee: false,
        canChangeWeights: true,
        canAddRemoveTokens: true,
        canWhitelistLPs: true,
        canChangeCap: false,
    },
    FUND_TOKEN_SUPPLY: toWei("1000000000"), // MAX
    MIM_WEIGHTS_CHANGE_BLOCK: 10,
    ADD_TOKEN_TIME_LOCK_IN_BLOCK: 10,
}

export async function convertBalance(balance: BN, erc20: string): Promise<string> {
    const ERC20Token = artifacts.require<ERC20TokenContract>("ERC20Token")
    const erc20Instance: ERC20TokenInstance = await ERC20Token.at(erc20)
    const erc20Decimals = await erc20Instance.decimals()
    return toDecimals(balance, erc20Decimals)
}
