/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ethers } from "@nomiclabs/buidler"
import { BigNumber, utils } from "ethers"
import { Amm } from "../../types/ethers"
import { CoinGeckoService } from "../CoinGeckoService"
import { ContractWrapper } from "./ContractWrapper"
import { AmmDeployArgs } from "./DeployConfig"

export class AmmContractWrapper extends ContractWrapper<Amm> {
    private coinGecko = new CoinGeckoService()

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

        const updatedQuoteAssetReserve = baseAssetReserve.mul(priceInWei).div(BigNumber.from(10).pow(18))
        const price = await this.coinGecko.fetchUsdPrice(priceFeedKey)
        const priceInWei = utils.parseEther(price)

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
