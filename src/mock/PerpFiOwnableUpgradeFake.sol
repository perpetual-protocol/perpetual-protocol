// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../utils/PerpFiOwnableUpgrade.sol";

contract PerpFiOwnableUpgradeFake is PerpFiOwnableUpgrade {
    constructor() public {}

    function initialize() public {
        __Ownable_init();
    }
}
