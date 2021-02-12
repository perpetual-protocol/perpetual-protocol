// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

contract StakedPerpTokenMock {
    uint256 public totalSupply;
    mapping(address => uint256) public balance;

    function mock_setTotalSupply(uint256 _totalSupply) public {
        totalSupply = _totalSupply;
    }

    function mock_setBalance(address _staker, uint256 _balance) external {
        balance[_staker] = _balance;
    }

    function balanceOf(address _staker) external view returns (uint256) {
        return balance[_staker];
    }
}
