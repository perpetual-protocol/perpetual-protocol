import BN from "bn.js"
import { ClearingHouseContract, ClearingHouseInstance } from "../../types"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class ClearingHouse extends AbstractContractWrapper<ClearingHouseContract, ClearingHouseInstance> {
    readonly contractAlias = ContractName.ClearingHouse
    readonly contractFileName = ContractName.ClearingHouse

    private readonly initMarginRequirement = new BN(5).mul(ClearingHouse.DEFAULT_DIGITS).div(new BN(100)) // 5%
    private readonly maintenanceMarginRequirement = new BN(25).mul(ClearingHouse.DEFAULT_DIGITS).div(new BN(1000)) // 2.5%
    private readonly liquidationFeeRatio = new BN(125).mul(ClearingHouse.DEFAULT_DIGITS).div(new BN(10000)) // 1.25%

    async deploy(insuranceFund: string, metaTxGateway: string): Promise<ClearingHouseInstance> {
        return await super.deployUpgradableContract(
            this.initMarginRequirement.toString(),
            this.maintenanceMarginRequirement.toString(),
            this.liquidationFeeRatio.toString(),
            insuranceFund,
            metaTxGateway,
        )
    }
}
