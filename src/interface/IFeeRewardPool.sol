// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Decimal } from "../utils/Decimal.sol";

interface IFeeRewardPool {
    function notifyStake(address staker, Decimal.decimal calldata _amount) external;

    function notifyRewardAmount(uint256 _amount) external;
}
