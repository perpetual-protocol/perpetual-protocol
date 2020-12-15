// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../InsuranceFund.sol";

contract InsuranceFundFake is InsuranceFund {
    uint256 private timestamp = 1444004400;
    uint256 private number = 10001;

    // make internal function testable
    function testGetOrderedQuoteTokens(IERC20 _exceptionQuoteToken)
        external
        view
        returns (IERC20[] memory orderedTokens)
    {
        return getOrderedQuoteTokens(_exceptionQuoteToken);
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

    // Override BlockContext here
    function _blockTimestamp() internal view override returns (uint256) {
        return timestamp;
    }

    function _blockNumber() internal view override returns (uint256) {
        return number;
    }
}
