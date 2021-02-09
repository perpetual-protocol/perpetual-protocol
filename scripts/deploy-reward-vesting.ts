import { ethers, upgrades } from "@nomiclabs/buidler"
import { ContractName } from "../publish/ContractName"

async function main() {
    const perpAddress = "0xaFfB148304D38947193785D194972a7d0d9b7F68"
    const options = {
        unsafeAllowCustomTypes: true,
    }
    const Vesting = await ethers.getContractFactory(ContractName.PerpRewardVesting)
    const instance = await upgrades.deployProxy(Vesting, [perpAddress], options)
    await instance.deployed()
}

main()
