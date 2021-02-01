// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;

library AddressArray {
    function add(address[] storage addrArray, address addr) internal returns (bool) {
        if (addr == address(0) || isExisted(addrArray, addr)) {
            return false;
        }
        addrArray.push(addr);
        return true;
    }

    function remove(address[] storage addrArray, address addr) internal returns (address) {
        if (addr == address(0)) {
            return address(0);
        }

        uint256 lengthOfArray = addrArray.length;
        for (uint256 i; i < lengthOfArray; i++) {
            if (addr == addrArray[i]) {
                if (i != lengthOfArray - 1) {
                    addrArray[i] = addrArray[lengthOfArray - 1];
                }
                addrArray.pop();
                return addr;
            }
        }
        return address(0);
    }

    function isExisted(address[] memory addrArray, address addr) internal pure returns (bool) {
        for (uint256 i; i < addrArray.length; i++) {
            if (addr == addrArray[i]) return true;
        }
        return false;
    }
}
