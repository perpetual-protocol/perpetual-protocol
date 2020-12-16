// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../staking/StakedPerpToken.sol";

contract StakedPerpTokenFake is StakedPerpToken {
    uint256 private timestamp = 1444004400;
    uint256 private number = 10001;

    function mock_setBlockTimestamp(uint256 _timestamp) public {
        timestamp = _timestamp;
    }

    function mock_setBlockNumber(uint256 _number) public {
        number = _number;
    }

    function mock_getCurrentTimestamp() public view returns (uint256) {
        return _blockTimestamp();
    }

    function mock_getCurrentBlockNumber() public view returns (uint256) {
        return _blockNumber();
    }

    // Override BlockContext here
    function _blockTimestamp() internal view override returns (uint256) {
        return timestamp;
    }

    function _blockNumber() internal view override returns (uint256) {
        return number;
    }

    function balanceOfArr(address _owner, uint256 _index) external view returns (uint64, uint192) {
        return (balancesHistory[_owner].history[_index].time, balancesHistory[_owner].history[_index].value);
    }

    function totalSupplyArr(uint256 _index) external view returns (uint64, uint192) {
        return (totalSupplyHistory.history[_index].time, totalSupplyHistory.history[_index].value);
    }
}
