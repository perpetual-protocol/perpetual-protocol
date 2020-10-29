// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import "@chainlink/contracts/src/v0.6/interfaces/AggregatorInterface.sol";


contract ChainlinkAggregatorMock is AggregatorInterface {
    uint256[] timestamp;
    int256[] answer;

    // prettier-ignore
    function latestAnswer() external view override returns (int256) {
        return answer[answer.length - 1];
    }

    // prettier-ignore
    function latestTimestamp() external override view returns (uint256) {
        return timestamp[timestamp.length - 1];
    }

    // prettier-ignore
    function latestRound() external override view returns (uint256) {
        return answer.length - 1;
    }

    // prettier-ignore
    function getAnswer(uint256 roundId) external override view returns (int256) {
        return answer[roundId];
    }

    // prettier-ignore
    function getTimestamp(uint256 roundId) external override view returns (uint256) {
        return timestamp[roundId];
    }

    function mockAddAnswer(int256 _answer, uint256 _timestamp) external {
        answer.push(_answer);
        timestamp.push(_timestamp);
    }
}
