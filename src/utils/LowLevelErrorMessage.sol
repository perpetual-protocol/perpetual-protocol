// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { BytesLib } from "solidity-bytes-utils/contracts/BytesLib.sol";

abstract contract LowLevelErrorMessage {
    using BytesLib for bytes;

    function _getRevertMessage(bytes memory _res) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_res.length < 68) return "Transaction reverted silently";
        bytes memory revertData = _res.slice(4, _res.length - 4); // Remove the selector which is the first 4 bytes
        return abi.decode(revertData, (string)); // All that remains is the revert string
    }
}
