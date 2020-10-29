// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "../utils/Decimal.sol";


interface IBaseBridge {
    function erc20Transfer(IERC20 _token, address _receiver, Decimal.decimal calldata _amount) external;

    function callOtherSideFunction(address _contractOnOtherSide, bytes calldata _data, uint256 _gasLimit)
        external
        returns (bytes32 messageId);
}
