import BigNumber from "bignumber.js"
import BN from "bn.js"

export const DEFAULT_TOKEN_DECIMALS = 18
export const ONE_DAY = 60 * 60 * 24

export type MixedDecimal = number | BN | string

export interface Decimal {
    d: MixedDecimal
}

// noinspection JSMethodCanBeStatic
export function toFullDigit(val: number | string, decimals = DEFAULT_TOKEN_DECIMALS): BN {
    const tokenDigit = new BigNumber("10").exponentiatedBy(decimals)
    const bigNumber = new BigNumber(val).multipliedBy(tokenDigit).toFixed(0)
    return new BN(bigNumber)
}

export function toFullDigitStr(val: number | string): string {
    return toFullDigit(val).toString()
}

export function toDecimal(val: number | string): Decimal {
    return { d: toFullDigit(val).toString() }
}

export function fromDecimal(val: Decimal, decimals = DEFAULT_TOKEN_DECIMALS): BN {
    return new BN(val.d).mul(new BN(10).pow(new BN(decimals))).div(new BN(10).pow(new BN(DEFAULT_TOKEN_DECIMALS)))
}
