// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IRewardPool } from "../../interface/IRewardPool.sol";
import { Decimal } from "../../utils/Decimal.sol";

contract RewardPoolMock is IRewardPool {
    using Decimal for Decimal.decimal;
    event NotificationReceived(address staker, uint256 amount);

    function notifyStake(address staker, Decimal.decimal calldata _amount) external override {
        emit NotificationReceived(staker, _amount.toUint());
    }
}
