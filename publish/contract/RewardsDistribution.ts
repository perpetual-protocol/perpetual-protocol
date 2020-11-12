import { RewardsDistributionContract, RewardsDistributionInstance } from "types/truffle"
import { ContractName } from "../ContractName"
import { AbstractContractWrapper } from "./AbstractContractWrapper"

export class RewardsDistribution extends AbstractContractWrapper<
    RewardsDistributionContract,
    RewardsDistributionInstance
> {
    readonly contractAlias = ContractName.RewardsDistribution
    readonly contractFileName = ContractName.RewardsDistribution

    async deploy(minter: string, stakingReserve: string): Promise<RewardsDistributionInstance> {
        return await super.deployUpgradableContract(minter, stakingReserve)
    }
}
