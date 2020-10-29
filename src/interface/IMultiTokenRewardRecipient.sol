// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "../utils/Decimal.sol";

interface IMultiTokenRewardRecipient {
    function notifyTokenAmount(IERC20 _token, Decimal.decimal calldata _amount) external;
}
