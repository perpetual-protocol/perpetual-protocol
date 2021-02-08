// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { IPriceFeed } from "./interface/IPriceFeed.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";

contract ChainlinkPriceFeed is IPriceFeed, PerpFiOwnableUpgrade, BlockContext {
    using SafeMath for uint256;

    uint256 private constant TOKEN_DIGIT = 10**18;

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // key by currency symbol, eg ETH
    mapping(bytes32 => AggregatorV3Interface) public priceFeedMap;
    bytes32[] public priceFeedKeys;
    mapping(bytes32 => uint8) public priceFeedDecimalMap;
    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize() public initializer {
        __Ownable_init();
    }

    function addAggregator(bytes32 _priceFeedKey, address _aggregator) external onlyOwner {
        requireNonEmptyAddress(_aggregator);
        if (address(priceFeedMap[_priceFeedKey]) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        priceFeedMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
        priceFeedDecimalMap[_priceFeedKey] = AggregatorV3Interface(_aggregator).decimals();
    }

    function removeAggregator(bytes32 _priceFeedKey) external onlyOwner {
        requireNonEmptyAddress(address(getAggregator(_priceFeedKey)));
        delete priceFeedMap[_priceFeedKey];
        delete priceFeedDecimalMap[_priceFeedKey];

        uint256 length = priceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (priceFeedKeys[i] == _priceFeedKey) {
                // if the removal item is the last one, just `pop`
                if (i != length - 1) {
                    priceFeedKeys[i] = priceFeedKeys[length - 1];
                }
                priceFeedKeys.pop();
                break;
            }
        }
    }

    //
    // VIEW FUNCTIONS
    //

    function getAggregator(bytes32 _priceFeedKey) public view returns (AggregatorV3Interface) {
        return priceFeedMap[_priceFeedKey];
    }

    //
    // INTERFACE IMPLEMENTATION
    //

    function setLatestData(
        bytes32 _priceFeedKey,
        uint256 _price,
        uint256 _timestamp,
        uint256 _roundId
    ) external override {
        revert("not support");
    }

    function getPrice(bytes32 _priceFeedKey) external view override returns (uint256) {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (, int256 latestPrice, , , ) = aggregator.latestRoundData();
        return formatDecimals(uint256(latestPrice), priceFeedDecimalMap[_priceFeedKey]);
    }

    function getLatestTimestamp(bytes32 _priceFeedKey) external view override returns (uint256) {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (, , , uint256 latestTimestamp, ) = aggregator.latestRoundData();
        return latestTimestamp;
    }

    function getTwapPrice(bytes32 _priceFeedKey, uint256 _interval) external view override returns (uint256) {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));
        require(_interval != 0, "interval can't be 0");

        // 3 different timestamps, `previous`, `current`, `target`
        // `base` = now - _interval
        // `current` = current round timestamp from aggregator
        // `previous` = previous round timestamp form aggregator
        // now >= previous > current > = < base
        //
        //  while loop i = 0
        //  --+------+-----+-----+-----+-----+-----+
        //         base                 current  now(previous)
        //
        //  while loop i = 1
        //  --+------+-----+-----+-----+-----+-----+
        //         base           current previous now

        uint8 decimal = priceFeedDecimalMap[_priceFeedKey];
        (uint80 round, int256 latestPrice, , uint256 latestTimestamp, ) = aggregator.latestRoundData();
        uint256 baseTimestamp = _blockTimestamp().sub(_interval);
        // if latest updated timestamp is earlier than target timestamp, return the latest price.
        if (latestTimestamp < baseTimestamp || round == 0) {
            return formatDecimals(uint256(latestPrice), decimal);
        }

        // rounds are like snapshots, latestRound means the latest price snapshot. follow chainlink naming
        uint256 previousTimestamp = latestTimestamp;
        uint256 cumulativeTime = _blockTimestamp().sub(previousTimestamp);
        uint256 weightedPrice = uint256(latestPrice).mul(cumulativeTime);
        while (true) {
            if (round == 0) {
                // if cumulative time is less than requested interval, return current twap price
                return formatDecimals(weightedPrice.div(cumulativeTime), decimal);
            }

            round = round - 1;
            // get current round timestamp and price
            (, int256 currentPrice, , uint256 currentTimestamp, ) = aggregator.getRoundData(round);

            // check if current round timestamp is earlier than target timestamp
            if (currentTimestamp <= baseTimestamp) {
                // weighted time period will be (target timestamp - previous timestamp). For example,
                // now is 1000, _interval is 100, then target timestamp is 900. If timestamp of current round is 970,
                // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
                // instead of (970 - 880)
                weightedPrice = weightedPrice.add(uint256(currentPrice).mul(previousTimestamp.sub(baseTimestamp)));
                break;
            }

            uint256 timeFraction = previousTimestamp.sub(currentTimestamp);
            weightedPrice = weightedPrice.add(uint256(currentPrice).mul(timeFraction));
            cumulativeTime = cumulativeTime.add(timeFraction);
            previousTimestamp = currentTimestamp;
        }
        return formatDecimals(weightedPrice.div(_interval), decimal);
    }

    function getPreviousPrice(bytes32 _priceFeedKey, uint256 _numOfRoundBack) public view override returns (uint256) {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (uint80 round, , , , ) = aggregator.latestRoundData();
        require(round > 0 && round >= _numOfRoundBack, "Not enough history");
        (, int256 currentPrice, , uint256 currentTimestamp, ) =
            aggregator.getRoundData(round - uint80(_numOfRoundBack));
        return formatDecimals(uint256(currentPrice), priceFeedDecimalMap[_priceFeedKey]);
    }

    function getPreviousTimestamp(bytes32 _priceFeedKey, uint256 _numOfRoundBack)
        public
        view
        override
        returns (uint256)
    {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (uint80 round, , , , ) = aggregator.latestRoundData();
        require(round > 0 && round >= _numOfRoundBack, "Not enough history");
        (, , , uint256 currentTimestamp, ) = aggregator.getRoundData(round - uint80(_numOfRoundBack));
        return currentTimestamp;
    }

    //
    // REQUIRE FUNCTIONS
    //

    function requireNonEmptyAddress(address _addr) internal pure {
        require(_addr != address(0), "empty address");
    }

    //
    // INTERNAL VIEW FUNCTIONS
    //
    function formatDecimals(uint256 _price, uint8 _decimals) internal pure returns (uint256) {
        return _price.mul(TOKEN_DIGIT).div(10**uint256(_decimals));
    }
}
