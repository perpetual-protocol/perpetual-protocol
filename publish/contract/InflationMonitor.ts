import { InflationMonitorContract, InflationMonitorInstance } from "../../types"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class InflationMonitor extends AbstractContractWrapper<InflationMonitorContract, InflationMonitorInstance> {
    readonly contractAlias = ContractName.InflationMonitor
    readonly contractFileName = ContractName.InflationMonitor

    async deploy(minter: string): Promise<InflationMonitorInstance> {
        return await super.deployUpgradableContract(minter)
    }
}
