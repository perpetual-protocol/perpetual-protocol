// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { AddressArray } from "./utils/AddressArray.sol";
import { ClientBridge } from "./bridge/xDai/ClientBridge.sol";

contract TollPool is PerpFiOwnableUpgrade, DecimalERC20 {
    using Decimal for Decimal.decimal;
    using AddressArray for address[];

    uint256 public constant TOKEN_AMOUNT_LIMIT = 20;

    //
    // EVENTS
    //
    event TokenReceived(address token, uint256 amount);
    event TokenTransferred(address token, uint256 amount);
    event FeeTokenPoolDispatcherSet(address feeTokenPoolDispatcher);
    event FeeTokenAdded(address token);
    event FeeTokenRemoved(address token);

    //
    // MODIFIERS
    //
    modifier onlyClearingHouse() {
        require(_msgSender() == address(clearingHouse), "only clearingHouse");
        _;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    address public feeTokenPoolDispatcherL1;
    address[] public feeTokens;

    address public clearingHouse;
    ClientBridge public clientBridge;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(address _clearingHouse, ClientBridge _clientBridge) external initializer {
        require(address(_clearingHouse) != address(0) && address(_clientBridge) != address(0), "invalid input");
        __Ownable_init();
        clearingHouse = _clearingHouse;
        clientBridge = _clientBridge;
    }

    function transferToFeeTokenPoolDispatcher() external {
        require(address(feeTokenPoolDispatcherL1) != address(0), "feeTokenPoolDispatcherL1 not yet set");
        require(feeTokens.length != 0, "feeTokens not set yet");

        bool hasToll;
        for (uint256 i; i < feeTokens.length; i++) {
            address token = feeTokens[i];
            hasToll = transferToDispatcher(IERC20(token)) || hasToll;
        }
        // revert if total fee of all tokens is zero
        require(hasToll, "fee is now zero");
    }

    function setFeeTokenPoolDispatcher(address _feeTokenPoolDispatcherL1) external onlyOwner {
        require(_feeTokenPoolDispatcherL1 != address(0), "invalid input");
        require(_feeTokenPoolDispatcherL1 != feeTokenPoolDispatcherL1, "input is the same as the current one");
        feeTokenPoolDispatcherL1 = _feeTokenPoolDispatcherL1;
        emit FeeTokenPoolDispatcherSet(_feeTokenPoolDispatcherL1);
    }

    function addFeeToken(IERC20 _token) external onlyOwner {
        require(feeTokens.length < TOKEN_AMOUNT_LIMIT, "exceed token amount limit");
        require(feeTokens.add(address(_token)), "invalid input");

        emit FeeTokenAdded(address(_token));
    }

    function removeFeeToken(IERC20 _token) external onlyOwner {
        address removedAddr = feeTokens.remove(address(_token));
        require(removedAddr != address(0), "token does not exist");
        require(removedAddr == address(_token), "remove wrong token");

        if (_token.balanceOf(address(this)) > 0) {
            transferToDispatcher(_token);
        }
        emit FeeTokenRemoved(address(_token));
    }

    //
    // VIEW FUNCTIONS
    //
    function isFeeTokenExisted(IERC20 _token) public view returns (bool) {
        return feeTokens.isExisted(address(_token));
    }

    function getFeeTokenLength() external view returns (uint256) {
        return feeTokens.length;
    }

    //
    // INTERNAL FUNCTIONS
    //
    function transferToDispatcher(IERC20 _token) private returns (bool) {
        Decimal.decimal memory balance = _balanceOf(_token, address(this));

        if (balance.toUint() != 0) {
            _approve(_token, address(clientBridge), balance);
            clientBridge.erc20Transfer(_token, address(feeTokenPoolDispatcherL1), balance);
            emit TokenTransferred(address(_token), balance.toUint());
            return true;
        }
        return false;
    }
}
