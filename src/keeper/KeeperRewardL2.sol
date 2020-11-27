// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Decimal } from "../utils/Decimal.sol";
import { KeeperRewardBase } from "./KeeperRewardBase.sol";
import { IAmm } from "../interface/IAmm.sol";
import { IClearingHouse } from "../interface/IClearingHouse.sol";
import { PerpToken } from "../PerpToken.sol";

contract KeeperRewardL2 is KeeperRewardBase {
    using Decimal for Decimal.decimal;

    function initialize(PerpToken _perpToken) external {
        __BaseKeeperReward_init(_perpToken);
    }

    function payFunding(IAmm _amm) external {
        bytes4 selector = IClearingHouse.payFunding.selector;
        TaskInfo memory task = taskMap[selector];
        requireNonEmptyAddress(task.contractAddr);

        address keeper = _msgSender();
        IClearingHouse(task.contractAddr).payFunding(_amm);
        _transfer(perpToken, keeper, task.rewardAmount);

        emit KeeperCalled(keeper, selector, task.rewardAmount.toUint());
    }
}
