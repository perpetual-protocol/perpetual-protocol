// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { ERC20Fake } from "../ERC20Fake.sol";

contract CUsdtMock is ERC20Fake {
    address underlyingAddr;

    function underlying() external view returns (address) {
        return underlyingAddr;
    }

    function mockSetUnderlying(address _underlying) external {
        underlyingAddr = _underlying;
    }

    uint256 exchangeRate = 1e16;

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRate;
    }

    function mockSetExchangeRateStored(uint256 _exchangeRate) external {
        exchangeRate = _exchangeRate;
    }
}
