// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { RootBridge } from "./bridge/ethereum/RootBridge.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";

contract ChainlinkL1 is PerpFiOwnableUpgrade, BlockContext {
    using SafeMath for uint256;
    using Decimal for Decimal.decimal;

    uint256 private constant TOKEN_DIGIT = 10**18;

    event RootBridgeChanged(address rootBridge);
    event PriceFeedL2Changed(address priceFeedL2);
    event PriceUpdateMessageIdSent(bytes32 messageId);
    event PriceUpdated(uint80 roundId, uint256 price, uint256 timestamp);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // key by currency symbol, eg ETH
    mapping(bytes32 => AggregatorV3Interface) public priceFeedMap;
    bytes32[] public priceFeedKeys;
    RootBridge public rootBridge;
    address public priceFeedL2Address;
    mapping(bytes32 => uint256) public prevTimestampMap;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(address _rootBridge, address _priceFeedL2) public initializer {
        __Ownable_init();
        setRootBridge(_rootBridge);
        setPriceFeedL2(_priceFeedL2);
    }

    function setRootBridge(address _rootBridge) public onlyOwner {
        requireNonEmptyAddress(_rootBridge);
        rootBridge = RootBridge(_rootBridge);
        emit RootBridgeChanged(_rootBridge);
    }

    function setPriceFeedL2(address _priceFeedL2) public onlyOwner {
        requireNonEmptyAddress(_priceFeedL2);
        priceFeedL2Address = _priceFeedL2;
        emit PriceFeedL2Changed(_priceFeedL2);
    }

    function addAggregator(bytes32 _priceFeedKey, address _aggregator) external onlyOwner {
        requireNonEmptyAddress(_aggregator);
        if (address(priceFeedMap[_priceFeedKey]) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        priceFeedMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
    }

    function removeAggregator(bytes32 _priceFeedKey) external onlyOwner {
        requireNonEmptyAddress(address(getAggregator(_priceFeedKey)));
        delete priceFeedMap[_priceFeedKey];

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

    function getAggregator(bytes32 _priceFeedKey) public view returns (AggregatorV3Interface) {
        return priceFeedMap[_priceFeedKey];
    }

    //
    // INTERFACE IMPLEMENTATION
    //

    function updateLatestRoundData(bytes32 _priceFeedKey) external {
        AggregatorV3Interface aggregator = getAggregator(_priceFeedKey);
        requireNonEmptyAddress(address(aggregator));

        (uint80 roundId, int256 price, , uint256 timestamp, ) = aggregator.latestRoundData();
        require(timestamp > prevTimestampMap[_priceFeedKey], "incorrect timestamp");
        require(price >= 0, "negative answer");

        uint8 decimals = aggregator.decimals();

        Decimal.decimal memory decimalPrice = Decimal.decimal(formatDecimals(uint256(price), decimals));
        bytes32 messageId =
            rootBridge.updatePriceFeed(priceFeedL2Address, _priceFeedKey, decimalPrice, timestamp, roundId);
        emit PriceUpdateMessageIdSent(messageId);
        emit PriceUpdated(roundId, decimalPrice.toUint(), timestamp);

        prevTimestampMap[_priceFeedKey] = timestamp;
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
