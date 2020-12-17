// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";

abstract contract KeeperRewardBase is PerpFiOwnableUpgrade, DecimalERC20 {
    event KeeperCalled(address keeper, bytes4 func, uint256 reward);

    struct TaskInfo {
        address contractAddr;
        Decimal.decimal rewardAmount;
    }

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//

    IERC20 public rewardToken;

    // key by function selector
    mapping(bytes4 => TaskInfo) public tasksMap;

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    function __BaseKeeperReward_init(IERC20 _rewardToken) internal initializer {
        __Ownable_init();
        rewardToken = _rewardToken;
    }

    /**
     * @dev set functions those keepers can get reward by call one of them.
            The size of these three array MUST be the same.
     * @param _funcSelectors array of function selectors to be executed
     * @param _contracts array of contract addresses those include corresponding _funcSelectors. 
                         Can be zero to reset corresponding selector.
     * @param _rewardAmount array of reward amount corresponding to different functions 
     */
    function setKeeperFunctions(
        bytes4[] calldata _funcSelectors,
        address[] calldata _contracts,
        uint256[] calldata _rewardAmount
    ) external onlyOwner {
        uint256 selectorLen = _funcSelectors.length;
        require(selectorLen == _contracts.length && selectorLen == _rewardAmount.length, "inconsistent input size");

        for (uint256 i; i < selectorLen; i++) {
            bytes4 selector = _funcSelectors[i];
            tasksMap[selector].contractAddr = _contracts[i];
            tasksMap[selector].rewardAmount = Decimal.decimal(_rewardAmount[i]);
        }
    }

    //
    // INTERNAL FUNCTIONS
    //

    /**
     * @dev need to check taskInfo is not empty before calling this.
     */
    function postTaskAction(bytes4 _selector) internal {
        TaskInfo memory task = tasksMap[_selector];
        address keeper = _msgSender();
        _transfer(rewardToken, keeper, task.rewardAmount);

        emit KeeperCalled(keeper, _selector, task.rewardAmount.toUint());
    }

    /**
     * @dev revert if contract address of the task is empty.
     */
    function getTaskInfo(bytes4 _selector) internal view returns (TaskInfo memory task) {
        task = tasksMap[_selector];
        requireNonEmptyAddress(task.contractAddr);
    }

    function requireNonEmptyAddress(address _addr) internal pure {
        require(_addr != address(0), "cannot find contract addr");
    }
}
