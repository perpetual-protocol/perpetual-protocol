// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

// solhint-disable
import {
    ERC20PresetMinterPauserUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/presets/ERC20PresetMinterPauser.sol";


contract ERC20Simple is ERC20PresetMinterPauserUpgradeSafe {
    bytes32 public constant STRIKE_PROTOCOL = keccak256("STRIKE_PROTOCOL");

    function initializeERC20Simple(uint256 initialSupply, string memory name, string memory symbol) public initializer {
        ERC20PresetMinterPauserUpgradeSafe.initialize(name, symbol);
        _mint(_msgSender(), initialSupply);
    }

    // prettier-ignore
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        require(allowableTransfer(_msgSender(), recipient), "oops! only allow to transfer from/to strike protocol");
        return super.transfer(recipient, amount);
    }

    // prettier-ignore
    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        require(allowableTransfer(_msgSender(), recipient), "oops! only allow to transfer from/to strike protocol");
        return super.transferFrom(sender, recipient, amount);
    }

    function addStrikeProtocolMember(address member) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "must have admin role");
        _setupRole(STRIKE_PROTOCOL, member);
    }

    function allowableTransfer(address sender, address recipient) internal view returns (bool) {
        return hasRole(STRIKE_PROTOCOL, recipient) || hasRole(STRIKE_PROTOCOL, sender);
    }
}
