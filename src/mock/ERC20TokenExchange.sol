// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


// providing optional methods (name, symbol and decimals)
contract ERC20TokenExchange is ERC20 {
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) public ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }

    // prettier-ignore
    function _approve(address owner, address spender, uint256 amount) internal override {
        require(allowance(owner, spender) == 0 || amount == 0, "ERC20: approve non zero amount");
        super._approve(owner, spender, amount);
    }
}
