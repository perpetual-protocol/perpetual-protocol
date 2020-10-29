// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Amm } from "./Amm.sol";
import { Decimal } from "./utils/MixedDecimal.sol";


contract AmmReader {
    using Decimal for Decimal.decimal;
    struct AmmStates {
        uint256 quoteAssetReserve;
        uint256 baseAssetReserve;
        uint256 tradeLimitRatio;
        uint256 fundingPeriod;
        string quoteAssetSymbol;
        bytes32 priceFeedKey;
        address priceFeed;
    }

    function getAmmStates(address _amm) external view returns (AmmStates memory) {
        Amm amm = Amm(_amm);
        (bool getSymbolSuccess, bytes memory quoteAssetSymbolData) = address(amm.quoteAsset()).staticcall(
            abi.encodeWithSignature("symbol()")
        );
        (Decimal.decimal memory quoteAssetReserve, Decimal.decimal memory baseAssetReserve) = amm.getReserve();
        return
            AmmStates({
                quoteAssetReserve: quoteAssetReserve.toUint(),
                baseAssetReserve: baseAssetReserve.toUint(),
                tradeLimitRatio: amm.tradeLimitRatio(),
                fundingPeriod: amm.fundingPeriod(),
                priceFeed: address(amm.priceFeed()),
                priceFeedKey: amm.priceFeedKey(),
                quoteAssetSymbol: getSymbolSuccess ? abi.decode(quoteAssetSymbolData, (string)) : ""
            });
    }
}
