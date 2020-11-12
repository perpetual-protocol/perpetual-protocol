/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetaTxGatewayContract, MetaTxGatewayInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class MetaTxGateway extends AbstractContractWrapper<MetaTxGatewayContract, MetaTxGatewayInstance> {
    readonly contractAlias = ContractName.MetaTxGateway
    readonly contractFileName = ContractName.MetaTxGateway

    async deploy(name: string, version: string, chainIdL1: number): Promise<MetaTxGatewayInstance> {
        return await super.deployUpgradableContract(name, version, chainIdL1)
    }
}
