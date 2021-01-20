// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../../utils/SignedDecimal.sol";
import "../../Amm.sol";

contract AmmMock {
    using SafeMath for uint256;
    using Decimal for Decimal.decimal;
    using SignedDecimal for SignedDecimal.signedDecimal;
    using MixedDecimal for SignedDecimal.signedDecimal;

    event Dir(Amm.Dir dir);

    IERC20 public quoteAsset;
    Decimal.decimal public quoteAssetReserve;
    Decimal.decimal public baseAssetReserve;

    /*
     * For removeMargin mocks
     */
    Decimal.decimal private outputTwap;
    Decimal.decimal private outputPrice;
    Decimal.decimal private inputPrice;

    constructor() public {}

    /*
     * For payFundingRate mocks
     */
    SignedDecimal.signedDecimal private _fundingRate;

    function mockSetFundingRate(SignedDecimal.signedDecimal memory _fr) public {
        _fundingRate = _fr;
    }

    function mockSetQuoteAsset(IERC20 _quoteAsset) public {
        quoteAsset = _quoteAsset;
    }

    function fundingRate() public view returns (SignedDecimal.signedDecimal memory) {
        return _fundingRate;
    }

    function settleFunding() public {}

    function mockSetOutputTwap(Decimal.decimal memory _outputTwap) public {
        outputTwap = _outputTwap;
    }

    function mockSetOutputPrice(Decimal.decimal memory _outputPrice) public {
        outputPrice = _outputPrice;
    }

    function mockSetInputPrice(Decimal.decimal memory _inputPrice) public {
        inputPrice = _inputPrice;
    }

    function getOutputTwap(Amm.Dir, Decimal.decimal calldata) external view returns (Decimal.decimal memory) {
        return outputTwap;
    }

    function getOutputPrice(Amm.Dir, Decimal.decimal calldata) external view returns (Decimal.decimal memory) {
        return outputPrice;
    }

    function getInputPrice(Amm.Dir, Decimal.decimal calldata) external view returns (Decimal.decimal memory) {
        return inputPrice;
    }

    function getReserve() external view returns (Decimal.decimal memory, Decimal.decimal memory) {
        return (quoteAssetReserve, baseAssetReserve);
    }

    function swapInput(
        Amm.Dir,
        Decimal.decimal calldata,
        Decimal.decimal calldata
    ) external returns (Decimal.decimal memory) {
        return inputPrice;
    }

    function swapOutput(Amm.Dir, Decimal.decimal calldata) external returns (Decimal.decimal memory) {
        return outputPrice;
    }

    function mockSetBaseAssetReserve(Decimal.decimal memory _baseAssetReserve) public {
        baseAssetReserve = _baseAssetReserve;
    }

    function mockSetQuoteAssetReserve(Decimal.decimal memory _quoteAssetReserve) public {
        quoteAssetReserve = _quoteAssetReserve;
    }
}
