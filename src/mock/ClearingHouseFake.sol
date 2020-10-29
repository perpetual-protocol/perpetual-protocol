// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../ClearingHouse.sol";
import "../Amm.sol";

contract ClearingHouseFake is ClearingHouse {
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

    function mock_getCurrentBlockNumber() public view returns (uint256) {
        return _blockNumber();
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

    function mockSetRestrictionMode(Amm _amm) external {
        enterRestrictionMode(_amm);
    }

    function isInRestrictMode(Amm _amm, uint256 _block) external view returns (bool) {
        return ammMap[address(_amm)].lastRestrictionBlock == _block;
    }
}
