// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IFeeRewardPool } from "../../interface/IFeeRewardPool.sol";
import { Decimal } from "../../utils/Decimal.sol";

contract FeeRewardPoolMock is IFeeRewardPool {
    using Decimal for Decimal.decimal;
    event NotificationReceived(address staker);
    event FeeNotificationReceived(uint256 amount);

    function notifyStake(address staker) external override {
        emit NotificationReceived(staker);
    }

    function notifyRewardAmount(Decimal.decimal calldata _amount) external override {
        emit FeeNotificationReceived(_amount.toUint());
    }
}
