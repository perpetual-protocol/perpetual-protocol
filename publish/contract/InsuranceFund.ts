import { InsuranceFundContract, InsuranceFundInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class InsuranceFund extends AbstractContractWrapper<InsuranceFundContract, InsuranceFundInstance> {
    readonly contractAlias = ContractName.InsuranceFund
    readonly contractFileName = ContractName.InsuranceFund

    async deploy(): Promise<InsuranceFundInstance> {
        return await super.deployUpgradableContract()
    }
}
