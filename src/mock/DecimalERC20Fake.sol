// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { Decimal } from "../utils/Decimal.sol";

// a testing purpose container contract which used DecimalERC20 library
contract DecimalERC20Fake is DecimalERC20 {
    function transfer(
        IERC20 _token,
        address _receiver,
        Decimal.decimal calldata _amount
    ) external {
        _transfer(_token, _receiver, _amount);
    }

    function transferFrom(
        IERC20 _token,
        address _sender,
        address _receiver,
        Decimal.decimal calldata _amount
    ) external {
        _transferFrom(_token, _sender, _receiver, _amount);
    }

    function approve(
        IERC20 _token,
        address _spender,
        Decimal.decimal calldata _amount
    ) external {
        _approve(_token, _spender, _amount);
    }

    function allowance(
        IERC20 _token,
        address _owner,
        address _spender
    ) external view returns (Decimal.decimal memory) {
        return _allowance(_token, _owner, _spender);
    }

    function balanceOf(IERC20 _token, address _owner) external view returns (Decimal.decimal memory) {
        return _balanceOf(_token, _owner);
    }
}
