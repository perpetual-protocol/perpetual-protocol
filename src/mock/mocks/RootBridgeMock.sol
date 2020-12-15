// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../../bridge/ethereum/RootBridge.sol";
import "../../utils/DecimalERC20.sol";

contract RootBridgeMock is DecimalERC20 {
    uint256 public messageId;
    uint256 public price;

    function updatePriceFeed(
        address _priceFeedAddrOnL2,
        bytes32 _priceFeedKey,
        Decimal.decimal calldata _price,
        uint256 _timestamp,
        uint256 _roundId
    ) external returns (bytes32) {
        price = _price.d;
        return bytes32(messageId);
    }

    function mockSetMessageId(uint256 _num) external {
        messageId = _num;
    }
}
