/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from "bn.js"
import { TetherTokenContract, TetherTokenInstance } from "../../types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class TetherToken extends AbstractContractWrapper<TetherTokenContract, TetherTokenInstance> {
    readonly contractAlias = ContractName.TetherToken
    readonly contractFileName = ContractName.TetherToken

    static DEFAULT_DIGITS = new BN("1000000")

    async deploy(): Promise<TetherTokenInstance> {
        return await super.deployContract(this.initSupply, "Tether USD", "USDT", 6)
    }

    get initSupply(): BN {
        return new BN("10000000000").mul(TetherToken.DEFAULT_DIGITS)
    }
}
