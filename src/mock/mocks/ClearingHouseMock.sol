// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../../interface/IClearingHouse.sol";

contract ClearingHouseMock is IClearingHouse {
    function addMargin(IAmm _amm, Decimal.decimal calldata _addedMargin) external override {}

    function removeMargin(IAmm _amm, Decimal.decimal calldata _removedMargin) external override {}

    function settlePosition(IAmm _amm) external override {}

    function openPosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal calldata _quoteAssetAmount,
        Decimal.decimal calldata _leverage,
        Decimal.decimal calldata _baseAssetAmountLimit
    ) external override {}

    function closePosition(IAmm _amm, Decimal.decimal calldata _quoteAssetAmountLimit) external override {}

    function liquidate(IAmm _amm, address _trader) external override {}

    event TestEventForPayFunding(address);

    function payFunding(IAmm _amm) external override {
        emit TestEventForPayFunding(address(_amm));
    }

    // VIEW FUNCTIONS
    function getMarginRatio(IAmm _amm, address _trader)
        external
        view
        override
        returns (SignedDecimal.signedDecimal memory)
    {}

    function getPosition(IAmm _amm, address _trader) external view override returns (Position memory) {}
}
