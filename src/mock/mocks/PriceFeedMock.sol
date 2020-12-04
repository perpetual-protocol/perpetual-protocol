// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;

import "../../interface/IPriceFeed.sol";

contract PriceFeedMock {
    uint256 price;

    constructor(uint256 _price) public {
        price = _price;
    }

    function getPrice(bytes32) public view returns (uint256) {
        return price;
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }
}
