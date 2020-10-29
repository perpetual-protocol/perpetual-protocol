// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAMB } from "./external/IAMB.sol";
import { IBaseBridge } from "./IBaseBridge.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";

// solhint-disable-next-line
abstract contract BaseBridge is PerpFiOwnableUpgrade, IBaseBridge, DecimalERC20 {
    using Decimal for Decimal.decimal;

    bytes4 private constant RELAY_TOKENS = 0xad58bdd1; // relayTokens(address,address,uint256)
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
    address public ambBridge;

    // xDai multi-tokens mediator
    address public multiTokenMediator;

    //**********************************************************//
    //  The order of above state variables can not be changed   //
    //**********************************************************//

    //
    // PUBLIC
    //
    function __BaseBridge_init(address _ambBridge, address _multiTokenMediator) internal initializer {
        __Ownable_init();
        setAMBBridge(_ambBridge);
        setMultiTokenMediator(_multiTokenMediator);
    }

    function setAMBBridge(address _addr) public onlyOwner {
        require(_addr != address(0), "address is empty");
        ambBridge = _addr;
        emit BridgeChanged(_addr);
    }

    function setMultiTokenMediator(address _addr) public onlyOwner {
        require(_addr != address(0), "address is empty");
        multiTokenMediator = _addr;
        emit MultiTokenMediatorChanged(multiTokenMediator);
    }

    // prettier-ignore
    function erc20Transfer(IERC20 _token, address _receiver, Decimal.decimal calldata _amount) external override {
        multiTokenTransfer(_token, _receiver, _amount);
    }

    // prettier-ignore
    function callOtherSideFunction(address _contractOnOtherSide, bytes calldata _data, uint256 _gasLimit) external override returns (bytes32 messageId) {
        return callBridge(_contractOnOtherSide, _data, _gasLimit);
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
        // solhint-disable avoid-low-level-calls
        (bool ret, ) = multiTokenMediator.call(
            abi.encodeWithSelector(RELAY_TOKENS, address(_token), _receiver, _toUint(_token, _amount))
        );
        require(ret, "BaseBridge: call relayTokens error");
        emit Relayed(address(_token), _receiver, _amount.toUint());
    }

    function callBridge(
        address _contractOnOtherSide,
        bytes memory _data,
        uint256 _gasLimit
    ) internal virtual returns (bytes32 messageId) {
        // server can check event, `UserRequestForAffirmation(bytes32 indexed messageId, bytes encodedData)`,
        // emitted by amb bridge contract
        messageId = IAMB(ambBridge).requireToPassMessage(_contractOnOtherSide, _data, _gasLimit);
    }

    function approveToMediator(IERC20 _token) private {
        if (_allowance(_token, address(this), multiTokenMediator).toUint() != uint256(-1)) {
            _approve(_token, multiTokenMediator, Decimal.decimal(uint256(-1)));
        }
    }
}
