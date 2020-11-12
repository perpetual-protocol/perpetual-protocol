import { AmmReaderContract, AmmReaderInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class AmmReader extends AbstractContractWrapper<AmmReaderContract, AmmReaderInstance> {
    readonly contractAlias = ContractName.AmmReader
    readonly contractFileName = ContractName.AmmReader

    async deploy(): Promise<AmmReaderInstance> {
        return await super.deployContract()
    }
}
