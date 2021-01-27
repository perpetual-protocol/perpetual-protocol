// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "../utils/Decimal.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { AddressArray } from "../utils/AddressArray.sol";
import { IRewardRecipient } from "../interface/IRewardRecipient.sol";

contract FeeTokenPoolDispatcherL1 is PerpFiOwnableUpgrade, DecimalERC20 {
    using AddressArray for address[];

    uint256 public constant TOKEN_AMOUNT_LIMIT = 20;
    //
    // EVENTS
    //
    event FeeRewardPoolAdded(address token, address feeRewardPool);
    event FeeRewardPoolRemoved(address token, address feeRewardPool);
    event FeeTransferred(address token, address feeRewardPool, uint256 amount);

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//

    mapping(IERC20 => IRewardRecipient) public feeRewardPoolMap;
    address[] public feeTokens;

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize() external initializer {
        __Ownable_init();
    }

    function transferToFeeRewardPool() public {
        require(feeTokens.length != 0, "feeTokens not set yet");

        bool hasFee;
        for (uint256 i; i < feeTokens.length; i++) {
            hasFee = transferToPool(IERC20(feeTokens[i])) || hasFee;
        }
        // revert if the fee of all tokens is zero
        require(hasFee, "fee is now zero");
    }

    function addFeeRewardPool(IRewardRecipient _recipient) external onlyOwner {
        require(address(_recipient) != address(0), "invalid input");
        require(feeTokens.length <= TOKEN_AMOUNT_LIMIT, "exceed token amount limit");

        IERC20 token = _recipient.token();
        require(feeTokens.add(address(token)), "token is already existed");

        feeRewardPoolMap[token] = _recipient;
        emit FeeRewardPoolAdded(address(token), address(_recipient));
    }

    function removeFeeRewardPool(IRewardRecipient _recipient) external onlyOwner {
        require(address(_recipient) != address(0), "invalid input");

        IERC20 token = _recipient.token();
        address removedAddr = feeTokens.remove(address(token));
        require(removedAddr != address(0), "token does not exist");
        require(removedAddr == address(token), "remove wrong token");

        if (token.balanceOf(address(this)) > 0) {
            transferToPool(token);
        }
        IRewardRecipient feeRewardPool = feeRewardPoolMap[token];
        delete feeRewardPoolMap[token];
        emit FeeRewardPoolRemoved(address(token), address(feeRewardPool));
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
    function transferToPool(IERC20 _token) private returns (bool) {
        Decimal.decimal memory balance = _balanceOf(_token, address(this));

        if (balance.toUint() != 0) {
            IRewardRecipient feeRewardPool = feeRewardPoolMap[_token];
            _transfer(_token, address(feeRewardPool), balance);
            feeRewardPool.notifyRewardAmount(balance);

            emit FeeTransferred(address(_token), address(feeRewardPool), balance.toUint());
            return true;
        }

        return false;
    }
}
