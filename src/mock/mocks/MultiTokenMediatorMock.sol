// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract MultiTokenMediatorMock {
    function relayTokens(address token, address receiver, uint256 amount) external {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
}
