// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { IPriceFeed } from "./interface/IPriceFeed.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";

contract ChainlinkL2 is PerpFiOwnableUpgrade, BlockContext {
    using SafeMath for uint256;
    using Decimal for Decimal.decimal;

    uint256 private constant TOKEN_DIGIT = 10**18;

    struct PriceFeedAggregator {
        AggregatorV3Interface aggregator;
        uint8 decimal;
        uint256 latestUpdateTime;
    }

    event PriceFeedChanged(address priceFeed);
    event PriceUpdated(uint80 roundId, uint256 price, uint256 timestamp);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // key by currency symbol, eg ETH
    mapping(bytes32 => PriceFeedAggregator) public aggregatorMap;
    bytes32[] public priceFeedKeys;

    IPriceFeed public priceFeedAddress;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(IPriceFeed _priceFeed) public initializer {
        __Ownable_init();
        setPriceFeed(_priceFeed);
    }

    function setPriceFeed(IPriceFeed _priceFeed) public onlyOwner {
        requireNonEmptyAddress(address(_priceFeed));
        priceFeedAddress = _priceFeed;
        emit PriceFeedChanged(address(_priceFeed));
    }

    function addAggregator(bytes32 _priceFeedKey, address _aggregator) external onlyOwner {
        requireNonEmptyAddress(_aggregator);

        PriceFeedAggregator storage priceFeedAggregator = aggregatorMap[_priceFeedKey];
        if (address(priceFeedAggregator.aggregator) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        priceFeedAggregator.aggregator = AggregatorV3Interface(_aggregator);
        priceFeedAggregator.decimal = AggregatorV3Interface(_aggregator).decimals();
        priceFeedAggregator.latestUpdateTime = _blockTimestamp();
    }

    function removeAggregator(bytes32 _priceFeedKey) external onlyOwner {
        requireNonEmptyAddress(address(getAggregator(_priceFeedKey)));
        delete aggregatorMap[_priceFeedKey];

        uint256 length = priceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (priceFeedKeys[i] == _priceFeedKey) {
                if (i != length - 1) {
                    priceFeedKeys[i] = priceFeedKeys[length - 1];
                }
                priceFeedKeys.pop();
                break;
            }
        }
    }

    function getAggregator(bytes32 _priceFeedKey) public view returns (AggregatorV3Interface) {
        return aggregatorMap[_priceFeedKey].aggregator;
    }

    function updateLatestRoundData(bytes32 _priceFeedKey) external {
        PriceFeedAggregator memory priceFeedAggregator = aggregatorMap[_priceFeedKey];
        requireNonEmptyAddress(address(priceFeedAggregator.aggregator));

        (uint80 roundId, int256 price, , uint256 timestamp, ) = priceFeedAggregator.aggregator.latestRoundData();
        require(timestamp > priceFeedAggregator.latestUpdateTime, "incorrect timestamp");
        require(price >= 0, "negative answer");

        uint256 priceIn18Digits = formatDecimals(uint256(price), priceFeedAggregator.decimal);
        priceFeedAddress.setLatestData(_priceFeedKey, priceIn18Digits, timestamp, roundId);
        emit PriceUpdated(roundId, priceIn18Digits, timestamp);

        aggregatorMap[_priceFeedKey].latestUpdateTime = timestamp;
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
