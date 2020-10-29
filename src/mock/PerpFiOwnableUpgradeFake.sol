// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../utils/PerpFiOwnableUpgrade.sol";


contract PerpFiOwnableUpgradeFake is PerpFiOwnableUpgrade {
    constructor() public {}

    function initialize() public {
        __Ownable_init();
    }
}
