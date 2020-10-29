// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;


contract PerpTokenMock {
    uint256 public totalSupply;

    function setTotalSupply(uint256 _totalSupply) public {
        totalSupply = _totalSupply;
    }
}
