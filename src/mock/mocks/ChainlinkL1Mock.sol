// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";


contract ChainlinkL1Mock is AggregatorV3Interface {
    uint80[] roundIdArray;
    int256[] answerArray;
    uint256[] decimalsArray;
    uint256[] timestampArray;
    uint80[] versionArray;

    // prettier-ignore
    function decimals() external override view returns (uint8) {
        return 8;
    }

    // prettier-ignore
    function description() external override view returns (string memory) {
        return "";
    }

    // prettier-ignore
    function version() external override view returns (uint256) {
        return 0;
    }

    // prettier-ignore
    function getRoundData(uint80 _roundId)
    external
    override
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {}

    // prettier-ignore
    function latestRoundData()
    external
    override
    view
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    ) {
        uint index = roundIdArray.length - 1;
        return (roundIdArray[index], answerArray[index], decimalsArray[index], timestampArray[index], versionArray[index]);
    }

    function mockAddAnswer(
        uint80 _roundId,
        int256 _answer,
        uint256 _startedAt,
        uint256 _updatedAt,
        uint80 _answeredInRound
    ) external {
        roundIdArray.push(_roundId);
        answerArray.push(_answer);
        decimalsArray.push(_startedAt);
        timestampArray.push(_updatedAt);
        versionArray.push(_answeredInRound);
    }
}
