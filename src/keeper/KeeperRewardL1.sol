// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Decimal } from "../utils/Decimal.sol";
import { KeeperRewardBase } from "./KeeperRewardBase.sol";
import { ChainlinkL1 } from "../ChainlinkL1.sol";
import { PerpToken } from "../PerpToken.sol";

contract KeeperRewardL1 is KeeperRewardBase {
    using Decimal for Decimal.decimal;

    function initialize(PerpToken _perpToken) external {
        __BaseKeeperReward_init(_perpToken);
    }

    function updatePriceFeed(bytes32 _priceFeedKey) external {
        bytes4 selector = ChainlinkL1.updateLatestRoundData.selector;
        TaskInfo memory task = taskMap[selector];
        requireNonEmptyAddress(task.contractAddr);

        address keeper = _msgSender();
        ChainlinkL1(task.contractAddr).updateLatestRoundData(_priceFeedKey);
        _transfer(perpToken, keeper, task.rewardAmount);

        emit KeeperCalled(keeper, selector, task.rewardAmount.toUint());
    }
}
