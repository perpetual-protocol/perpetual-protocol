// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { IAMB } from "./external/IAMB.sol";
import { IBaseBridge } from "./IBaseBridge.sol";
import { IMultiTokenMediator } from "./external/IMultiTokenMediator.sol";
import { DecimalERC20, Decimal } from "../utils/DecimalERC20.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";

abstract contract BaseBridge is PerpFiOwnableUpgrade, IBaseBridge, DecimalERC20 {
    using Decimal for Decimal.decimal;

    //
    // EVENTS
    //
    event BridgeChanged(address bridge);
    event MultiTokenMediatorChanged(address mediator);
    event Relayed(address token, address receiver, uint256 amount);

    //**********************************************************//
    //   The order of below state variables can not be changed  //
    //**********************************************************//

    // xDai AMB bridge contract
    IAMB public ambBridge;

    // xDai multi-tokens mediator
    IMultiTokenMediator public multiTokenMediator;

    //**********************************************************//
    //  The order of above state variables can not be changed   //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // PUBLIC
    //
    function __BaseBridge_init(IAMB _ambBridge, IMultiTokenMediator _multiTokenMediator) internal initializer {
        __Ownable_init();
        setAMBBridge(_ambBridge);
        setMultiTokenMediator(_multiTokenMediator);
    }

    function setAMBBridge(IAMB _ambBridge) public onlyOwner {
        require(address(_ambBridge) != address(0), "address is empty");
        ambBridge = _ambBridge;
        emit BridgeChanged(address(_ambBridge));
    }

    function setMultiTokenMediator(IMultiTokenMediator _multiTokenMediator) public onlyOwner {
        require(address(_multiTokenMediator) != address(0), "address is empty");
        multiTokenMediator = _multiTokenMediator;
        emit MultiTokenMediatorChanged(address(_multiTokenMediator));
    }

    function erc20Transfer(
        IERC20 _token,
        address _receiver,
        Decimal.decimal calldata _amount
    ) external override {
        require(_amount.toUint() > 0, "amount is zero");
        multiTokenTransfer(_token, _receiver, _amount);
    }

    //
    // INTERNAL
    //
    function multiTokenTransfer(
        IERC20 _token,
        address _receiver,
        Decimal.decimal memory _amount
    ) internal virtual {
        require(_receiver != address(0), "receiver is empty");
        // transfer tokens from msg sender
        _transferFrom(_token, _msgSender(), address(this), _amount);

        // approve to multi token mediator and call 'relayTokens'
        approveToMediator(_token);

        multiTokenMediator.relayTokens(address(_token), _receiver, _toUint(_token, _amount));
        emit Relayed(address(_token), _receiver, _amount.toUint());
    }

    function callBridge(
        address _contractOnOtherSide,
        bytes memory _data,
        uint256 _gasLimit
    ) internal virtual returns (bytes32 messageId) {
        // server can check event, `UserRequestForAffirmation(bytes32 indexed messageId, bytes encodedData)`,
        // emitted by amb bridge contract
        messageId = ambBridge.requireToPassMessage(_contractOnOtherSide, _data, _gasLimit);
    }

    function approveToMediator(IERC20 _token) private {
        if (_allowance(_token, address(this), address(multiTokenMediator)).toUint() != uint256(-1)) {
            _approve(_token, address(multiTokenMediator), Decimal.decimal(uint256(-1)));
        }
    }
}
