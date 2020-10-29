// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./utils/PerpFiOwnable.sol";


contract PerpToken is ERC20, PerpFiOwnable {
    mapping(address => bool) public minters;

    constructor(uint256 _initialSupply) public ERC20("Perpetual", "PERP") {
        _mint(msg.sender, _initialSupply);
    }

    function mint(address account, uint256 amount) external {
        require(minters[msg.sender], "!minter");
        _mint(account, amount);
    }

    function addMinter(address _minter) external onlyOwner {
        minters[_minter] = true;
    }

    function removeMinter(address _minter) external onlyOwner {
        minters[_minter] = false;
    }
}
