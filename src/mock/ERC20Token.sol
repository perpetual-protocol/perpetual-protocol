// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


// providing optional methods (name, symbol and decimals)
contract ERC20Token is ERC20 {
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) public ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }
}
