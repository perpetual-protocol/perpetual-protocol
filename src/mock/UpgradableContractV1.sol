pragma solidity 0.6.9;

import { Initializable } from "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

contract UpgradableContractV1 is Initializable {
    uint256 public version;
    address public owner;

    function initialize() public initializer {
        version = 1;
        owner = msg.sender;
    }
}
