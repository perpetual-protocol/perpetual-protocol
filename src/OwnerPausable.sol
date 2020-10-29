// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import { PausableUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";


contract OwnerPausableUpgradeSafe is PerpFiOwnableUpgrade, PausableUpgradeSafe {
    // solhint-disable func-name-mixedcase
    function __OwnerPausable_init() internal initializer {
        __Ownable_init();
        __Pausable_init();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    uint256[49] private __gap;
}
