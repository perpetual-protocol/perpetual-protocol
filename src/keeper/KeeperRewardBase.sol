// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { PerpToken } from "../PerpToken.sol";

abstract contract KeeperRewardBase is PerpFiOwnableUpgrade, DecimalERC20 {
    event KeeperCalled(address keeper, bytes4 func, uint256 reward);

    struct TaskInfo {
        address contractAddr;
        Decimal.decimal rewardAmount;
    }

    PerpToken public perpToken;

    // key by function selector
    mapping(bytes4 => TaskInfo) taskMap;

    function __BaseKeeperReward_init(PerpToken _perp) internal initializer {
        __Ownable_init();
        perpToken = _perp;
    }

    function setKeeperFunctions(
        bytes4[] calldata _funcSelectors,
        address[] calldata _contracts,
        uint256[] calldata _rewardAmount
    ) external onlyOwner {
        for (uint256 i; i < _funcSelectors.length; i++) {
            bytes4 selector = _funcSelectors[i];
            taskMap[selector].contractAddr = _contracts[i];
            taskMap[selector].rewardAmount = Decimal.decimal(_rewardAmount[i]);
        }
    }

    function requireNonEmptyAddress(address _addr) internal pure {
        require(_addr != address(0), "cannot find contract addr");
    }
}
