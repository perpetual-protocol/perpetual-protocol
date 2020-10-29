// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
import { L2PriceFeed } from "../L2PriceFeed.sol";


contract L2PriceFeedFake is L2PriceFeed {
    uint256 private timestamp = 1444004400;
    uint256 private number = 10001;

    function mock_setBlockTimestamp(uint256 _timestamp) public {
        timestamp = _timestamp;
    }

    function mock_setBlockNumber(uint256 _number) public {
        number = _number;
    }

    function mock_getCurrentTimestamp() public view returns (uint256) {
        return _blockTimestamp();
    }

    // Override BlockContext here
    //prettier-ignore
    function _blockTimestamp() internal override view returns (uint256) {
        return timestamp;
    }

    //prettier-ignore
    function _blockNumber() internal override view returns (uint256) {
        return number;
    }

    // override Context here

    address payable msgSender;

    function mockSetMsgSender(address payable _addr) external {
        msgSender = _addr;
    }

    //prettier-ignore
    function _msgSender() internal view override returns (address payable) {
        if(msgSender == address(0)){
            return msg.sender;
        }
        return msgSender;
    }
}
