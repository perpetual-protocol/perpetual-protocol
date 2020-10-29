// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { SignedDecimal, MixedDecimal } from "./utils/MixedDecimal.sol";
import { IAmm } from "./interface/IAmm.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { ClearingHouse } from "./ClearingHouse.sol";

contract ClearingHouseViewer {
    using Decimal for Decimal.decimal;
    using SignedDecimal for SignedDecimal.signedDecimal;
    using MixedDecimal for SignedDecimal.signedDecimal;

    ClearingHouse public clearingHouse;

    //
    // FUNCTIONS
    //

    constructor(ClearingHouse _clearingHouse) public {
        clearingHouse = _clearingHouse;
    }

    //
    // Public
    //

    /**
     * @notice get unrealized PnL
     * @param _amm IAmm address
     * @param _trader trader address
     * @param _pnlCalcOption ClearingHouse.PnlCalcOption, can be SPOT_PRICE or TWAP.
     * @return unrealized PnL in 18 digits
     */
    function getUnrealizedPnl(
        IAmm _amm,
        address _trader,
        ClearingHouse.PnlCalcOption _pnlCalcOption
    ) external view returns (SignedDecimal.signedDecimal memory) {
        (, SignedDecimal.signedDecimal memory unrealizedPnl) = (
            clearingHouse.getPositionNotionalAndUnrealizedPnl(_amm, _trader, _pnlCalcOption)
        );
        return unrealizedPnl;
    }

    /**
     * @notice get personal balance with funding payment
     * @param _quoteToken ERC20 token address
     * @param _trader trader address
     * @return margin personal balance with funding payment in 18 digits
     */
    function getPersonalBalanceWithFundingPayment(IERC20 _quoteToken, address _trader)
        external
        view
        returns (Decimal.decimal memory margin)
    {
        IInsuranceFund insuranceFund = clearingHouse.insuranceFund();
        IAmm[] memory amms = insuranceFund.getAllAmms();
        for (uint256 i = 0; i < amms.length; i++) {
            if (IAmm(amms[i]).quoteAsset() != _quoteToken) {
                continue;
            }
            Decimal.decimal memory posMargin = getPersonalPositionWithFundingPayment(amms[i], _trader).margin;
            margin = margin.addD(posMargin);
        }
    }

    /**
     * @notice get personal position with funding payment
     * @param _amm IAmm address
     * @param _trader trader address
     * @return position ClearingHouse.Position struct
     */
    function getPersonalPositionWithFundingPayment(IAmm _amm, address _trader)
        public
        view
        returns (ClearingHouse.Position memory position)
    {
        position = clearingHouse.getPosition(_amm, _trader);
        SignedDecimal.signedDecimal memory marginWithFundingPayment = MixedDecimal.fromDecimal(position.margin).addD(
            getFundingPayment(position, clearingHouse.getLatestCumulativePremiumFraction(_amm))
        );
        position.margin = marginWithFundingPayment.toInt() >= 0 ? marginWithFundingPayment.abs() : Decimal.zero();
    }

    /**
     * @notice get personal margin ratio
     * @param _amm IAmm address
     * @param _trader trader address
     * @return personal margin ratio in 18 digits
     */
    function getMarginRatio(IAmm _amm, address _trader) external view returns (SignedDecimal.signedDecimal memory) {
        return clearingHouse.getMarginRatio(_amm, _trader);
    }

    //
    // PRIVATE
    //

    // negative means trader paid and vice versa
    function getFundingPayment(
        ClearingHouse.Position memory _position,
        SignedDecimal.signedDecimal memory _latestCumulativePremiumFraction
    ) private pure returns (SignedDecimal.signedDecimal memory) {
        return
            _position.size.toInt() == 0
                ? SignedDecimal.zero()
                : _latestCumulativePremiumFraction
                    .subD(_position.lastUpdatedCumulativePremiumFraction)
                    .mulD(_position.size)
                    .mulScalar(-1);
    }
}
