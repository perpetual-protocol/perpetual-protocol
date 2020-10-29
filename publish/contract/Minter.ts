import { MinterContract, MinterInstance } from "../../types"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class Minter extends AbstractContractWrapper<MinterContract, MinterInstance> {
    readonly contractAlias = ContractName.Minter
    readonly contractFileName = ContractName.Minter

    async deploy(perpToken: string): Promise<MinterInstance> {
        return await super.deployUpgradableContract(perpToken)
    }
}
