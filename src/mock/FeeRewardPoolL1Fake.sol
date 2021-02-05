// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../staking/FeeRewardPoolL1.sol";

contract FeeRewardPoolL1Fake is FeeRewardPoolL1 {
    uint256 private timestamp = 1444004400;
    uint256 private number = 10001;

    address public stakedPerpTokenAddr;

    modifier onlyStakedPerpToken() override {
        require(msg.sender == stakedPerpTokenAddr, "only FeeTokenPoolDispatcherL1");
        _;
    }

    function mock_setStakedPerpTokenAddr(address _stakedPerpTokenAddr) public {
        stakedPerpTokenAddr = _stakedPerpTokenAddr;
    }

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
}
