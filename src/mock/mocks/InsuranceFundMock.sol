// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../../InsuranceFund.sol";

contract InsuranceFundMock is DecimalERC20 {
    function withdraw(IERC20 _quoteToken, Decimal.decimal calldata _amount) external {
        _transfer(_quoteToken, msg.sender, _amount);
    }
}
