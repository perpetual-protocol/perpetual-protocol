import { ExchangeWrapperContract, ExchangeWrapperInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class ExchangeWrapper extends AbstractContractWrapper<ExchangeWrapperContract, ExchangeWrapperInstance> {
    readonly contractAlias = ContractName.ExchangeWrapper
    readonly contractFileName = ContractName.ExchangeWrapper

    async deploy(): Promise<ExchangeWrapperInstance> {
        return await super.deployUpgradableContract()
    }
}
