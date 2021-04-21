/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { BigNumber } from "@ethersproject/bignumber"
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
        let oldClearingHouseImpAddr: string
        let oldAmmImpAddr: string
        let newClearingHouseImplAddr: string
        let newAmmImplAddr: string
        let ammETHAddr: string
        let arbitrageurPosition: any
        let oldQuoteAssetReserve: BigNumber
        let quoteAssetAddr: string
        return [
            async (): Promise<void> => {
                console.log("get state variables for verification later...")

                // flat clearingHouse
                const fileClearingHouse = `${ContractName.ClearingHouse}.sol`
                await flatten(SRC_DIR, hre.config.paths.sources, fileClearingHouse)
                await hre.run(TASK_COMPILE)

                // flat Amm
                const fileAmm = `${ContractName.Amm}.sol`
                await flatten(SRC_DIR, hre.config.paths.sources, fileAmm)
                await hre.run(TASK_COMPILE)

                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()
                const ammContract = await context.factory
                    .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.FlattenAmmUnderClearingHouse)
                    .instance()

                oldClearingHouseImpAddr = await getImplementation(clearingHouseContract.address)
                oldAmmImpAddr = await getImplementation(ammContract.address)
                ammETHAddr = ammContract.address

                arbitrageur = context.externalContract.arbitrageur!
                arbitrageurPosition = await clearingHouseContract.getPosition(ammETHAddr, arbitrageur)
                oldQuoteAssetReserve = await ammContract.quoteAssetReserve()
                quoteAssetAddr = await ammContract.quoteAsset()
            },
            async (): Promise<void> => {
                console.log("prepare upgrading...")

                // deploy clearingHouse implementation
                const clearingHouseContract = await context.factory.create<ClearingHouse>(
                    ContractFullyQualifiedName.FlattenClearingHouse,
                )
                newClearingHouseImplAddr = await clearingHouseContract.prepareUpgradeContractLegacy()

                // deploy Amm implementation
                const ammContract = await context.factory.createAmm(
                    AmmInstanceName.ETHUSDC,
                    ContractFullyQualifiedName.FlattenAmmUnderClearingHouse,
                )
                newAmmImplAddr = await ammContract.prepareUpgradeContractLegacy()
            },
            async (): Promise<void> => {
                console.info("upgrading...")

                // create an impersonated signer
                const govSigner = await impersonateAccount(context.externalContract.foundationGovernance!)

                // prepare information for upgrading
                const contractNameClearingHouse = ContractFullyQualifiedName.FlattenClearingHouse
                const proxyClearingHouseAddr = context.factory.create<ClearingHouse>(contractNameClearingHouse).address!

                const proxyAdmin = await upgrades.admin.getInstance()
                await proxyAdmin.connect(govSigner).upgrade(proxyClearingHouseAddr, newClearingHouseImplAddr)
                console.log(
                    `upgrade: contractFullyQualifiedName=${contractNameClearingHouse}, proxy=${proxyClearingHouseAddr}, implementation=${newClearingHouseImplAddr}`,
                )

                await proxyAdmin.connect(govSigner).upgrade(ammETHAddr, newAmmImplAddr)
                console.log(
                    `upgrade: contractFullyQualifiedName=${contractNameClearingHouse}, proxy=${ammETHAddr}, implementation=${newAmmImplAddr}`,
                )
            },
            // verify can openPosition
            async (): Promise<void> => {
                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()

                const gov = context.externalContract.foundationGovernance!
                const govSigner = await impersonateAccount(gov)
                const arbitrageurSigner = await impersonateAccount(arbitrageur)

                const usdcAddr = context.externalContract.usdc!
                const USDCArtifact = await artifacts.readArtifact(ContractFullyQualifiedName.FlattenIERC20)
                const usdcInstance = (await ethers.getContractAt(USDCArtifact.abi, usdcAddr)) as ERC20

                // send eth and usdc to gov account
                const txETH = await arbitrageurSigner.sendTransaction({
                    to: gov,
                    value: ethers.utils.parseEther("0.1"),
                })
                await txETH.wait()
                const txUSDC = await usdcInstance.connect(arbitrageurSigner).transfer(gov, parseUnits("1000", 6))
                await txUSDC.wait()
                const txApprove = await usdcInstance
                    .connect(govSigner)
                    .approve(clearingHouseContract.address, parseUnits("1000", 6))
                await txApprove.wait()

                // open position
                const receipt = await clearingHouseContract
                    .connect(govSigner)
                    .openPosition(
                        ammETHAddr,
                        Side.BUY,
                        { d: parseEther("600") },
                        { d: parseEther("1") },
                        { d: parseEther("0") },
                    )

                const ownerPosition = await clearingHouseContract.getPosition(ammETHAddr, gov)
                expect(ownerPosition.margin.d).to.eq(parseEther("600"))
                expect(ownerPosition.blockNumber).to.eq(receipt.blockNumber)
            },
            // verify arbitrageur's position on ETH market and Amm's reserve
            async (): Promise<void> => {
                const clearingHouseContract = await context.factory
                    .create<ClearingHouse>(ContractFullyQualifiedName.FlattenClearingHouse)
                    .instance()
                const ammContract = await context.factory
                    .createAmm(AmmInstanceName.ETHUSDC, ContractFullyQualifiedName.FlattenAmmUnderClearingHouse)
                    .instance()

                // for comparing with the new implementation address
                console.log("old implementation address of ClearingHouse: ", oldClearingHouseImpAddr)
                console.log(
                    "new implementation address of ClearingHouse: ",
                    await getImplementation(clearingHouseContract.address),
                )
                console.log("old implementation address of Amm: ", oldAmmImpAddr)
                console.log("new implementation address of Amm: ", await getImplementation(ammContract.address))

                console.log("arbitrageur position: ")
                const arbitrageurPositionNow = await clearingHouseContract.getPosition(ammETHAddr, arbitrageur)
                console.log("size: ", arbitrageurPositionNow.size.d.toString())
                console.log("margin: ", arbitrageurPositionNow.margin.d.toString())
                console.log("last updated blockNumber: ", arbitrageurPositionNow.blockNumber.toString())
                expect(arbitrageurPosition.size.d).to.eq(arbitrageurPositionNow.size.d)
                expect(arbitrageurPosition.margin.d).to.eq(arbitrageurPositionNow.margin.d)
                expect(arbitrageurPosition.blockNumber).to.eq(arbitrageurPositionNow.blockNumber)

                console.log("amm states: ")
                const newQuoteAssetReserve = await ammContract.quoteAssetReserve()
                console.log("quote asset reserve: ", oldQuoteAssetReserve.toString())
                console.log("USDC addr: ", quoteAssetAddr.toString())
                expect(newQuoteAssetReserve).to.eq(oldQuoteAssetReserve.add(parseEther("600")))
                expect(await ammContract.quoteAsset()).to.eq(quoteAssetAddr)
            },
        ]
    },
}

export default migration
