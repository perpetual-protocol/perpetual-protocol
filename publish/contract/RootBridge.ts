/* eslint-disable @typescript-eslint/no-explicit-any */
import { RootBridgeContract, RootBridgeInstance } from "../../types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class RootBridge extends AbstractContractWrapper<RootBridgeContract, RootBridgeInstance> {
    readonly contractAlias = ContractName.RootBridge
    readonly contractFileName = ContractName.RootBridge

    async deploy(ambBridge: string, multiTokenMediator: string): Promise<RootBridgeInstance> {
        return await super.deployUpgradableContract(ambBridge, multiTokenMediator)
    }
}
