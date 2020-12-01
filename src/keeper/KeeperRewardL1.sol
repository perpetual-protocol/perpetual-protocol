// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { KeeperRewardBase } from "./KeeperRewardBase.sol";
import { ChainlinkL1 } from "../ChainlinkL1.sol";
import { PerpToken } from "../PerpToken.sol";

contract KeeperRewardL1 is KeeperRewardBase {
    function initialize(PerpToken _perpToken) external {
        __BaseKeeperReward_init(_perpToken);
    }

    /**
     * @notice call this function to update price feed and get token reward
     */
    function updatePriceFeed(bytes32 _priceFeedKey) external {
        bytes4 selector = ChainlinkL1.updateLatestRoundData.selector;
        TaskInfo memory task = getTaskInfo(selector);

        ChainlinkL1(task.contractAddr).updateLatestRoundData(_priceFeedKey);
        postTaskAction(selector);
    }
}
