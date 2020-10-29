// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";


contract MetaTxRecipientMock is BaseRelayRecipient {
    //prettier-ignore
    string public override versionRecipient = "1.0.0"; // we are not using it atm

    address public pokedBy;

    constructor(address _trustedForwarder) public {
        trustedForwarder = _trustedForwarder;
    }

    function poke() external {
        pokedBy = _msgSender();
    }
}
