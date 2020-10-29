/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClientBridgeContract, ClientBridgeInstance } from "../../types"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class ClientBridge extends AbstractContractWrapper<ClientBridgeContract, ClientBridgeInstance> {
    readonly contractAlias = ContractName.ClientBridge
    readonly contractFileName = ContractName.ClientBridge

    async deploy(ambBridge: string, multiTokenMediator: string, metaTxGateway: string): Promise<ClientBridgeInstance> {
        return await super.deployUpgradableContract(ambBridge, multiTokenMediator, metaTxGateway)
    }
}
