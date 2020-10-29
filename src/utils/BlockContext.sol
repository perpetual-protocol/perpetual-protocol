// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;


// wrap block.xxx functions for testing
// only support timestamp and number so far
// solhint-disable
abstract contract BlockContext {
    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    function _blockTimestamp() internal virtual view returns (uint256) {
        return block.timestamp;
    }

    function _blockNumber() internal virtual view returns (uint256) {
        return block.number;
    }
}
