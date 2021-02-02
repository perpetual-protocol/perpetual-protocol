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
        fetchPrice = true,
    ): Promise<Amm> {
        const {
            quoteAssetReserve,
            baseAssetReserve,
            tradeLimitRatio,
            fundingPeriod,
            fluctuation,
            priceFeedKey,
            tollRatio,
            spreadRatio,
        } = ammDeployArgs

        let updatedQuoteAssetReserve: BigNumber = quoteAssetReserve
        if (fetchPrice) {
            const price = await this.coinGecko.fetchUsdPrice(priceFeedKey)
            const priceInWei = utils.parseEther(price)
            updatedQuoteAssetReserve = baseAssetReserve.mul(priceInWei).div(BigNumber.from(10).pow(18))
        }

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
