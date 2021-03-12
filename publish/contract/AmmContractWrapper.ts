/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { BigNumber } from "ethers"
import { Amm, IPriceFeed } from "../../types/ethers"
import { ContractWrapper } from "./ContractWrapper"
import { AmmDeployArgs } from "./DeployConfig"

export async function fetchPrice(feedAddress: string, feedKey: string): Promise<BigNumber> {
    const priceContract = (await ethers.getContractAt("IPriceFeed", feedAddress)) as IPriceFeed
    try {
        return priceContract.getPrice(feedKey)
    } catch {
        throw new Error("Wrong price feed address or key")
    }
}

export class AmmContractWrapper extends ContractWrapper<Amm> {
    async deployUpgradableContract(
        ammDeployArgs: AmmDeployArgs,
        priceFeedAddress: string,
        quoteAssetAddress: string,
    ): Promise<Amm> {
        const {
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            fluctuation,
            priceFeedKey,
            tollRatio,
            spreadRatio,
        } = ammDeployArgs

        const priceInWei = await fetchPrice(priceFeedAddress, priceFeedKey)
        const updatedQuoteAssetReserve = baseAssetReserve.mul(priceInWei).div(BigNumber.from(10).pow(18))

        const priceFeedKeyBytes = ethers.utils.formatBytes32String(priceFeedKey.toString())
        const args = [
            updatedQuoteAssetReserve.toString(),
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
