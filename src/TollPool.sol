// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { ITollPool } from "./interface/ITollPool.sol";
import { ClientBridge } from "./bridge/xDai/ClientBridge.sol";

contract TollPool is ITollPool, PerpFiOwnableUpgrade, DecimalERC20 {
    using Decimal for Decimal.decimal;

    //
    // EVENTS
    //
    event TokenReceived(address token, uint256 amount);
    event TokenTransferred(address token, uint256 amount);
    event TmpRewardPoolSet(address tmpRewardPoolL1);
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

    address public tmpRewardPoolL1;
    IERC20[] public feeTokens;

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

    function notifyTokenAmount(IERC20 _token, Decimal.decimal calldata _amount) external override onlyClearingHouse {
        require(_amount.toUint() != 0, "invalid input");
        require(isFeeTokenExisted(_token), "token does not exist");
        emit TokenReceived(address(_token), _amount.toUint());
    }

    function transferToTmpRewardPool() external override {
        require(address(tmpRewardPoolL1) != address(0), "tmpRewardPoolL1 not yet set");
        require(feeTokens.length != 0, "feeTokens not set yet");

        bool hasToll;
        for (uint256 i; i < feeTokens.length; i++) {
            IERC20 token = feeTokens[i];
            Decimal.decimal memory balance = _balanceOf(token, address(this));

            if (balance.toUint() != 0) {
                clientBridge.erc20Transfer(token, address(tmpRewardPoolL1), balance);
                hasToll = true;
                emit TokenTransferred(address(token), balance.toUint());
            }
        }
        // revert if total fee of all tokens is zero
        require(hasToll, "fee is now zero");
    }

    function setTmpRewardPool(address _tmpRewardPoolL1) external onlyOwner {
        require(_tmpRewardPoolL1 != address(0), "invalid input");
        require(_tmpRewardPoolL1 != tmpRewardPoolL1, "input is the same as the current one");
        tmpRewardPoolL1 = _tmpRewardPoolL1;
        emit TmpRewardPoolSet(_tmpRewardPoolL1);
    }

    function addFeeToken(IERC20 _token) external onlyOwner {
        require(address(_token) != address(0), "invalid input");
        require(!isFeeTokenExisted(_token), "token is already existed");
        feeTokens.push(_token);
        _approve(_token, address(clientBridge), Decimal.decimal(uint256(-1)));
        emit FeeTokenAdded(address(_token));
    }

    function removeFeeToken(IERC20 _token) external onlyOwner {
        require(address(_token) != address(0), "invalid input");
        require(isFeeTokenExisted(_token), "token does not exist");

        uint256 lengthOfFeeTokens = getFeeTokenLength();
        for (uint256 i; i < lengthOfFeeTokens; i++) {
            if (_token == feeTokens[i]) {
                _approve(_token, address(clientBridge), Decimal.zero());

                if (i != lengthOfFeeTokens - 1) {
                    feeTokens[i] = feeTokens[lengthOfFeeTokens - 1];
                }
                feeTokens.pop();
                emit FeeTokenRemoved(address(_token));
                break;
            }
        }
    }

    //
    // VIEW FUNCTIONS
    //
    function isFeeTokenExisted(IERC20 _token) public view returns (bool) {
        for (uint256 i; i < feeTokens.length; i++) {
            if (_token == feeTokens[i]) return true;
        }
        return false;
    }

    function getFeeTokenLength() public view returns (uint256) {
        return feeTokens.length;
    }
}
