// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

contract ChainlinkL1Mock {
    event PriceUpdated(uint256 roundId, uint256 price, uint256 timestamp);

    function updateLatestRoundData(bytes32 _priceFeedKey) external {
        emit PriceUpdated(100, 500, 1444004400);
    }
}
