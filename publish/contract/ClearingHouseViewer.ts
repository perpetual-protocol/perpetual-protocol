import { ClearingHouseViewerContract, ClearingHouseViewerInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class ClearingHouseViewer extends AbstractContractWrapper<
    ClearingHouseViewerContract,
    ClearingHouseViewerInstance
> {
    readonly contractAlias = ContractName.ClearingHouseViewer
    readonly contractFileName = ContractName.ClearingHouseViewer

    async deploy(clearingHouse: string): Promise<ClearingHouseViewerInstance> {
        return await super.deployContract(clearingHouse)
    }
}
