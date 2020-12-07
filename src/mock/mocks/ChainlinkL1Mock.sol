// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";

contract ChainlinkL1Mock is AggregatorV3Interface {
    uint80[] roundIdArray;
    int256[] answerArray;
    uint256[] decimalsArray;
    uint256[] timestampArray;
    uint80[] versionArray;

    function decimals() external view override returns (uint8) {
        return 8;
    }

    function description() external view override returns (string memory) {
        return "";
    }

    function version() external view override returns (uint256) {
        return 0;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {}

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        uint256 index = roundIdArray.length - 1;
        return (
            roundIdArray[index],
            answerArray[index],
            decimalsArray[index],
            timestampArray[index],
            versionArray[index]
        );
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
