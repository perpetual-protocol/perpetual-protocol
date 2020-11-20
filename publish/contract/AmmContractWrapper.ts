/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { Amm } from "../../types/ethers"
import { ContractWrapper } from "./ContractWrapper"
import { AmmConfigMap } from "./DeployConfig"

export class AmmContractWrapper extends ContractWrapper<Amm> {
    async deployUpgradableContract(
        ammConfigMap: AmmConfigMap,
        priceFeedAddress: string,
        quoteAssetAddress: string,
    ): Promise<Amm> {
        const ammConfig = ammConfigMap[this.contractInstanceName]
        const {
            quoteAssetReserve,
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            fluctuation,
            priceFeedKey,
            tollRatio,
            spreadRatio,
        } = ammConfig.deployArgs
        const priceFeedKeyBytes = ethers.utils.formatBytes32String(priceFeedKey.toString())
        const args = [
            quoteAssetReserve.toString(),
            baseAssetReserve.toString(),
            tradeLimitRatio.toString(),
            fundingPeriod.toString(),
            priceFeedAddress,
            priceFeedKeyBytes.toString(),
            quoteAssetAddress.toString(),
            fluctuation.toString(),
            tollRatio.toString(),
            spreadRatio.toString(),
        ]
        return super.deployUpgradableContract(...args)
    }
}
