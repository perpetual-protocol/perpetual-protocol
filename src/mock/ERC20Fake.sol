// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import {
    ERC20PresetMinterPauserUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";

// TODO rename to UpgradableMintableERC20
contract ERC20Fake is ERC20PresetMinterPauserUpgradeSafe {
    function initializeERC20Fake(
        uint256 initialSupply,
        string memory name,
        string memory symbol,
        uint8 decimal
    ) public initializer {
        ERC20PresetMinterPauserUpgradeSafe.initialize(name, symbol);
        _setupDecimals(decimal);
        _mint(_msgSender(), initialSupply);
    }
}
