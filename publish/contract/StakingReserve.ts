import BN from "bn.js"
import { Layer } from "../../scripts/common"
import { StakingReserveContract, StakingReserveInstance } from "../../types/truffle"
import { ContractName } from "../ContractName"
import { OzScript } from "../OzScript"
import { SettingsDao } from "../SettingsDao"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class StakingReserve extends AbstractContractWrapper<StakingReserveContract, StakingReserveInstance> {
    readonly contractAlias = ContractName.StakingReserve
    readonly contractFileName = ContractName.StakingReserve

    private readonly vestingPeriod = new BN(52) // 52 epoch

    constructor(
        protected readonly layerType: Layer,
        settingsDao: SettingsDao,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly ozScript: OzScript,
    ) {
        super(layerType, systemMetadataDao, ozScript)
        if (!settingsDao.isMainnet()) {
            this.vestingPeriod = new BN(24) // in ropsten the epoch is 1 hour
        }
    }

    async deploy(perpToken: string, supplySchedule: string, clearingHouse: string): Promise<StakingReserveInstance> {
        return await super.deployUpgradableContract(
            perpToken,
            supplySchedule,
            clearingHouse,
            this.vestingPeriod.toString(),
        )
    }
}
