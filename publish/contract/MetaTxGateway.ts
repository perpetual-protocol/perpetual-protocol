/* eslint-disable @typescript-eslint/no-explicit-any */
import { MetaTxGatewayContract, MetaTxGatewayInstance } from "../../types"
import { ContractName } from "../ContractName"

import { AbstractContractWrapper } from "./AbstractContractWrapper"
import { sleep } from "../../scripts/utils"

export class MetaTxGateway extends AbstractContractWrapper<MetaTxGatewayContract, MetaTxGatewayInstance> {
    readonly contractAlias = ContractName.MetaTxGateway
    readonly contractFileName = ContractName.MetaTxGateway

    async deploy(name: string, version: string, chainIdL1: number): Promise<MetaTxGatewayInstance> {
        return await super.deployUpgradableContract(name, version, chainIdL1)
    }
}
