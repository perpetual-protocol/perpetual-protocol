// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { BaseBridge, IAMB, IMultiTokenMediator, IERC20 } from "../BaseBridge.sol";
import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { ContextUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import { Decimal } from "../../utils/Decimal.sol";

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
    mapping(IERC20 => Decimal.decimal) public minWithdrawalAmountMap;

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

    /**
     * @notice set minimum withdrawal amount for different tokens
     */
    function setMinWithdrawalAmount(IERC20 _token, Decimal.decimal memory _amount) external onlyOwner {
        minWithdrawalAmountMap[_token] = _amount;
    }

    //
    // INTERNAL FUNCTIONS
    //
    function multiTokenTransfer(
        IERC20 _token,
        address _receiver,
        Decimal.decimal memory _amount
    ) internal override {
        require(_amount.cmp(minWithdrawalAmountMap[_token]) >= 0, "amount is too small");
        super.multiTokenTransfer(_token, _receiver, _amount);
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
