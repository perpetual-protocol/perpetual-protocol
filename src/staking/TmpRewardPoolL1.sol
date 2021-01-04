// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "../utils/Decimal.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { ITollPool } from "../interface/ITollPool.sol";
import { IFeeRewardPool } from "../interface/IFeeRewardPool.sol";

contract TmpRewardPoolL1 is PerpFiOwnableUpgrade, DecimalERC20 {
    //
    // EVENTS
    //
    event FeeRewardPoolAdded(address token, address feeRewardPool);
    event FeeRewardPoolRemoved(address token, address feeRewardPool);
    event FeeTransferred(address token, address feeRewardPool, uint256 amount);

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//

    mapping(IERC20 => IFeeRewardPool) public feeRewardPoolMap;
    IERC20[] public feeTokens;

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize() external {
        __Ownable_init();
    }

    function transferToFeeRewardPool() external {
        require(getFeeTokenLength() != 0, "feeTokens not set yet");

        bool hasFee;
        for (uint256 i; i < feeTokens.length; i++) {
            IERC20 token = feeTokens[i];
            Decimal.decimal memory balance = _balanceOf(token, address(this));

            if (balance.toUint() != 0) {
                IFeeRewardPool feeRewardPool = feeRewardPoolMap[token];
                _transfer(token, address(feeRewardPool), balance);
                feeRewardPool.notifyRewardAmount(balance);

                hasFee = true;
                emit FeeTransferred(address(token), address(feeRewardPool), balance.toUint());
            }
        }
        // revert if the fee of all tokens is zero
        require(hasFee, "fee is now zero");
    }

    function addFeeRewardPool(IERC20 _token, IFeeRewardPool _feeRewardPool) external onlyOwner {
        require(address(_token) != address(0) && address(_feeRewardPool) != address(0), "invalid input");
        require(!isFeeTokenExisted(_token), "token is already existed");

        feeTokens.push(_token);
        feeRewardPoolMap[_token] = _feeRewardPool;

        emit FeeRewardPoolAdded(address(_token), address(_feeRewardPool));
    }

    function removeFeeRewardPool(IERC20 _token) external onlyOwner {
        require(address(_token) != address(0), "invalid input");
        require(isFeeTokenExisted(_token), "token does not exist");

        uint256 lengthOfFeeTokens = getFeeTokenLength();
        for (uint256 i; i < lengthOfFeeTokens; i++) {
            if (_token == feeTokens[i]) {
                IFeeRewardPool feeRewardPool = feeRewardPoolMap[feeTokens[i]];
                if (i != lengthOfFeeTokens - 1) {
                    feeTokens[i] = feeTokens[lengthOfFeeTokens - 1];
                }

                feeTokens.pop();
                delete feeRewardPoolMap[_token];

                emit FeeRewardPoolRemoved(address(_token), address(feeRewardPool));
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
