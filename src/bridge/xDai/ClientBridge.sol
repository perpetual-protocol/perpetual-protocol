// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { BaseBridge, IAMB, IMultiTokenMediator } from "../BaseBridge.sol";
import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { ContextUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";

// note BaseRelayRecipient must come after OwnerPausableUpgradeSafe (in BaseBridge) so its _msgSender() takes precedence
// (yes, the ordering is reversed comparing to Python)
contract ClientBridge is BaseBridge, BaseRelayRecipient {
    //**********************************************************//
    //   The order of below state variables can not be changed  //
    //**********************************************************//

    string public override versionRecipient;

    //**********************************************************//
    //  The order of above state variables can not be changed   //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // PUBLIC
    //
    function initialize(
        IAMB _ambBridge,
        IMultiTokenMediator _multiTokenMediator,
        address _trustedForwarder
    ) public initializer {
        __BaseBridge_init(_ambBridge, _multiTokenMediator);

        trustedForwarder = _trustedForwarder;
        versionRecipient = "1.0.0"; // we are not using it atm
    }

    //
    // INTERNAL VIEW FUNCTIONS
    //
    function _msgSender() internal view override(BaseRelayRecipient, ContextUpgradeSafe) returns (address payable) {
        return super._msgSender();
    }

    function _msgData() internal view override(BaseRelayRecipient, ContextUpgradeSafe) returns (bytes memory ret) {
        return super._msgData();
    }
}
