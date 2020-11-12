/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from "bn.js"
import { PerpTokenContract, PerpTokenInstance } from "../../types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class PerpToken extends AbstractContractWrapper<PerpTokenContract, PerpTokenInstance> {
    readonly contractAlias = ContractName.PerpToken
    readonly contractFileName = ContractName.PerpToken

    async deploy(): Promise<PerpTokenInstance> {
        return await super.deployContract(this.initSupply)
    }

    get initSupply(): BN {
        return new BN("1500000000").mul(PerpToken.DEFAULT_DIGITS)
    }
}
