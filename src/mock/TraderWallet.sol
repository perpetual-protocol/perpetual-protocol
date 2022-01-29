// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { ClearingHouseFake } from "./ClearingHouseFake.sol";
import { Amm } from "../Amm.sol";
import { Decimal } from "../utils/Decimal.sol";

contract TraderWallet {
    ClearingHouseFake public clearingHouse;

    enum ActionType { OPEN, CLOSE, LIQUIDATE }

    constructor(ClearingHouseFake _clearingHouse, IERC20 _token) public {
        clearingHouse = _clearingHouse;
        _token.approve(address(clearingHouse), uint256(-1));
    }

    function openPosition(
        Amm _amm,
        ClearingHouseFake.Side _side,
        Decimal.decimal calldata _quoteAssetAmount,
        Decimal.decimal calldata _leverage,
        Decimal.decimal calldata _minBaseAssetAmount
    ) external {
        clearingHouse.openPosition(_amm, _side, _quoteAssetAmount, _leverage, _minBaseAssetAmount);
    }

    function liquidate(
        Amm _amm,
        address _trader,
        Decimal.decimal memory _quoteAssetAmount
    ) external {
        clearingHouse.liquidateWithSlippage(_amm, _trader, _quoteAssetAmount);
    }

    function closePosition(Amm _amm) external {
        clearingHouse.closePosition(_amm, Decimal.zero());
    }

    function multiActions(
        ActionType _action1,
        bool _setRestriction,
        ActionType _action2,
        Amm _amm,
        ClearingHouseFake.Side _side,
        Decimal.decimal calldata _quoteAssetAmount,
        Decimal.decimal calldata _leverage,
        Decimal.decimal calldata _baseAssetAmountLimit,
        address _trader
    ) external {
        executeAction(_action1, _amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit, _trader);
        if (_setRestriction) {
            clearingHouse.mockSetRestrictionMode(_amm);
        }
        executeAction(_action2, _amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit, _trader);
    }

    function twoLiquidations(
        Amm _amm,
        address _trader1,
        address _trader2
    ) external {
        clearingHouse.liquidate(_amm, _trader1);
        clearingHouse.liquidate(_amm, _trader2);
    }

    function threeLiquidations(
        Amm _amm,
        address _trader1,
        address _trader2,
        address _trader3
    ) external {
        clearingHouse.liquidate(_amm, _trader1);
        clearingHouse.liquidate(_amm, _trader2);
        clearingHouse.liquidate(_amm, _trader3);
    }

    function executeAction(
        ActionType _action,
        Amm _amm,
        ClearingHouseFake.Side _side,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit,
        address _trader
    ) internal {
        if (_action == ActionType.OPEN) {
            clearingHouse.openPosition(_amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit);
        } else if (_action == ActionType.CLOSE) {
            clearingHouse.closePosition(_amm, Decimal.zero());
        } else if (_action == ActionType.LIQUIDATE) {
            clearingHouse.liquidate(_amm, _trader);
        }
    }
}
