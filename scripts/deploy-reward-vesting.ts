import { ethers, upgrades } from "hardhat"
import { ContractFullyQualifiedName } from "../publish/ContractName"

async function main() {
    const perpAddress = "0xaFfB148304D38947193785D194972a7d0d9b7F68"
    const options = {
        unsafeAllowCustomTypes: true,
    }
    const Vesting = await ethers.getContractFactory(ContractFullyQualifiedName.PerpRewardVesting)
    const instance = await upgrades.deployProxy(Vesting, [perpAddress], options)
    await instance.deployed()
}

main()
