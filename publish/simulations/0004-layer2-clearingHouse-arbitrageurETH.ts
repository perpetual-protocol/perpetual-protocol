/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { JsonRpcSigner } from "@ethersproject/providers"
import { parseEther } from "@ethersproject/units"
import { expect } from "chai"
import { parseUnits } from "ethers/lib/utils"
import hre, { artifacts, ethers, upgrades } from "hardhat"
import { TASK_COMPILE } from "hardhat/builtin-tasks/task-names"
import { SRC_DIR } from "../../constants"
import { flatten } from "../../scripts/flatten"
import { ClearingHouse, ERC20 } from "../../types/ethers"
import { getImplementation } from "../contract/DeployUtil"
import { AmmInstanceName, ContractFullyQualifiedName, ContractName } from "../ContractName"
import { MigrationContext, MigrationDefinition } from "../Migration"

enum Side {
    BUY = 0,
    SELL = 1,
}

async function impersonateAccount(address: string): Promise<JsonRpcSigner> {
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address],
    })
    return ethers.provider.getSigner(address)
}

const migration: MigrationDefinition = {
    configPath: "hardhat.flatten.clearinghouse.config.ts",

    // deploy the flattened clearingHouse and init it just in case
    getTasks: (context: MigrationContext) => {
        let arbitrageur: string
        let oldImpAddr: string
        let ETH: string
        let arbitrageurPosition: any
        let newImplContractAddr: string
        return [
            async (): Promise<void> => {
                console.log("verifying state variables...")

                // have to first flatten contracts for creating instances
                const filename = `${ContractName.ClearingHouse}.sol`
                await flatten(SRC_DIR, hre.config.paths.sources, filename)
                // after flatten sol file we must re-compile again
                await hre.run(TASK_COMPILE)

                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                oldImpAddr = await getImplementation(clearingHouseContract.address)
                ETH = context.systemMetadataDao.getContractMetadata(context.layer, AmmInstanceName.ETHUSDC).address

                arbitrageur = context.externalContract.arbitrageur!
                arbitrageurPosition = await clearingHouseContract.getPosition(ETH, arbitrageur)
            },
            async (): Promise<void> => {
                console.log("prepare upgrading...")
                // deploy clearing house implementation
                const clearingHouseContract = await context.factory.create<ClearingHouse>(
                    ContractFullyQualifiedName.FlattenClearingHouse,
                )
                newImplContractAddr = await clearingHouseContract.prepareUpgradeContractLegacy()
            },
            async (): Promise<void> => {
                console.info("upgrading...")
                // create an impersonated signer
                const govAddr = context.externalContract.foundationGovernance
                await hre.network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [govAddr],
                })
                const govSigner = ethers.provider.getSigner(govAddr)

                // prepare information for upgrading
                const contractName = ContractFullyQualifiedName.FlattenClearingHouse
                const proxyAddr = context.factory.create<ClearingHouse>(contractName).address!

                const proxyAdmin = await upgrades.admin.getInstance()
                await proxyAdmin.connect(govSigner).upgrade(proxyAddr, newImplContractAddr)

                console.log(
                    `upgrade: contractFullyQualifiedName=${contractName}, proxy=${proxyAddr}, implementation=${newImplContractAddr}`,
                )
            },
            // verify can openPosition
            async (): Promise<void> => {
                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                const owner = context.externalContract.foundationGovernance!
                const ownerSigner = await impersonateAccount(owner)

                const arbitrageurSigner = await impersonateAccount(arbitrageur)

                const usdcAddr = context.externalContract.usdc!
                const USDCArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.FlattenIERC20)
                const usdcInstance = (await ethers.getContractAt(USDCArtifact.abi, usdcAddr)) as ERC20

                const tx = await usdcInstance.connect(arbitrageurSigner).transfer(owner, parseUnits("1000", 6))
                await tx.wait()

                const txApprove = await usdcInstance
                    .connect(ownerSigner)
                    .approve(clearingHouseContract.address, parseUnits("1000", 6))
                await txApprove.wait()

                const receipt = await clearingHouseContract
                    .connect(ownerSigner)
                    .openPosition(
                        ETH,
                        Side.BUY,
                        { d: parseEther("600") },
                        { d: parseEther("1") },
                        { d: parseEther("0") },
                    )

                const ownerPosition = await clearingHouseContract.getPosition(ETH, owner)
                expect(ownerPosition.margin.d).to.eq(parseEther("600"))
                expect(ownerPosition.blockNumber).to.eq(receipt.blockNumber)
            },
            // verify arbitrageur's ETH position
            async (): Promise<void> => {
                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                // for comparing with the new implementation address
                console.log("old implementation address: ", oldImpAddr)
                console.log("new implementation address: ", await getImplementation(clearingHouseContract.address))

                console.log("arbitrageur position: ")
                const arbitrageurPositionNow = await clearingHouseContract.getPosition(ETH, arbitrageur)

                console.log("size: ", arbitrageurPositionNow.size.d.toString())
                console.log("margin: ", arbitrageurPositionNow.margin.d.toString())
                console.log("last updated blockNumber: ", arbitrageurPositionNow.blockNumber.toString())
                expect(arbitrageurPosition.size.d).to.eq(arbitrageurPositionNow.size.d)
                expect(arbitrageurPosition.margin.d).to.eq(arbitrageurPositionNow.margin.d)
                expect(arbitrageurPosition.blockNumber).to.eq(arbitrageurPositionNow.blockNumber)

                console.log("arbitrageurETHPositionSize verified!")
            },
        ]
    },
}

export default migration
