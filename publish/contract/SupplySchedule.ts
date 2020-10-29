import BN from "bn.js"
import { SupplyScheduleContract, SupplyScheduleInstance } from "../../types"
import { ContractName } from "../ContractName"
import { SystemMetadataDao } from "../SystemMetadataDao"
import { OzScript } from "../OzScript"
import { AbstractContractWrapper } from "./AbstractContractWrapper"
import { Layer } from "../../scripts/common"
import { SettingsDao } from "../SettingsDao"

export class SupplySchedule extends AbstractContractWrapper<SupplyScheduleContract, SupplyScheduleInstance> {
    readonly contractAlias = ContractName.SupplySchedule
    readonly contractFileName = ContractName.SupplySchedule

    private HOUR = 60 * 60
    private DAY = 24 * this.HOUR
    private WEEK = 7 * this.DAY

    private readonly inflationRate = new BN(5).mul(SupplySchedule.DEFAULT_DIGITS).divn(1000) // 0.5%
    private readonly decayRate = new BN(1).mul(SupplySchedule.DEFAULT_DIGITS).divn(1000) // 0.1%
    private readonly mintDuration = new BN(this.WEEK).mul(SupplySchedule.DEFAULT_DIGITS)

    constructor(
        protected readonly layerType: Layer,
        protected readonly settingsDao: SettingsDao,
        protected readonly systemMetadataDao: SystemMetadataDao,
        protected readonly ozScript: OzScript,
    ) {
        super(layerType, settingsDao, systemMetadataDao, ozScript)
        if (!settingsDao.isMainnet()) {
            this.mintDuration = new BN(this.HOUR).mul(SupplySchedule.DEFAULT_DIGITS)
        }
    }

    async deploy(minter: string): Promise<SupplyScheduleInstance> {
        return await super.deployUpgradableContract(
            minter,
            this.inflationRate.toString(),
            this.decayRate.toString(),
            this.mintDuration.toString(),
        )
    }
}
