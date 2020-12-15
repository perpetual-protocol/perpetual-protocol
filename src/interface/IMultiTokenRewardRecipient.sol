// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "../utils/Decimal.sol";

interface IMultiTokenRewardRecipient {
    function notifyTokenAmount(IERC20 _token, Decimal.decimal calldata _amount) external;
}
