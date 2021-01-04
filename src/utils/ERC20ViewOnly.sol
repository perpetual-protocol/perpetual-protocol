// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

abstract contract ERC20ViewOnly is IERC20 {
    function transfer(address, uint256) public virtual override returns (bool) {
        revert("transfer() is not supported");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public virtual override returns (bool) {
        revert("transferFrom() is not supported");
    }

    function approve(address, uint256) public virtual override returns (bool) {
        revert("approve() is not supported");
    }

    function allowance(address, address) public view virtual override returns (uint256) {
        return 0;
    }
}
