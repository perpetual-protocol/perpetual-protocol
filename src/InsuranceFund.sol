// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import {
    ReentrancyGuardUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { IExchangeWrapper } from "./interface/IExchangeWrapper.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { IMinter } from "./interface/IMinter.sol";
import { IAmm } from "./interface/IAmm.sol";
import { IInflationMonitor } from "./interface/IInflationMonitor.sol";

contract InsuranceFund is IInsuranceFund, PerpFiOwnableUpgrade, BlockContext, ReentrancyGuardUpgradeSafe, DecimalERC20 {
    using Decimal for Decimal.decimal;

    //
    // EVENTS
    //

    event Withdrawn(address withdrawer, uint256 amount);
    event TokenAdded(address tokenAddress);
    event TokenRemoved(address tokenAddress);
    event ShutdownAllAmms(uint256 blockNumber);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    mapping(address => bool) private ammMap;
    mapping(address => bool) private quoteTokenMap;
    IAmm[] private amms;
    IERC20[] public quoteTokens;

    // contract dependencies
    IExchangeWrapper public exchange;
    IERC20 public perpToken;
    IMinter public minter;
    IInflationMonitor public inflationMonitor;
    address private beneficiary;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //

    function initialize() external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /**
     * @dev only owner can call
     * @param _amm IAmm address
     */
    function addAmm(IAmm _amm) public onlyOwner {
        require(!isExistedAmm(_amm), "amm already added");
        ammMap[address(_amm)] = true;
        amms.push(_amm);

        // add token if it's new one
        IERC20 token = _amm.quoteAsset();
        if (!isQuoteTokenExisted(token)) {
            quoteTokens.push(token);
            quoteTokenMap[address(token)] = true;
            emit TokenAdded(address(token));
        }
    }

    /**
     * @dev only owner can call. no need to call
     * @param _amm IAmm address
     */
    function removeAmm(IAmm _amm) external onlyOwner {
        require(isExistedAmm(_amm), "amm not existed");
        ammMap[address(_amm)] = false;
        uint256 ammLength = amms.length;
        for (uint256 i = 0; i < ammLength; i++) {
            if (amms[i] == _amm) {
                amms[i] = amms[ammLength - 1];
                amms.pop();
                break;
            }
        }
    }

    /**
     * @notice shutdown all Amms when fatal error happens
     * @dev only owner can call. Emit `ShutdownAllAmms` event
     */
    function shutdownAllAmm() external onlyOwner {
        if (!inflationMonitor.isOverMintThreshold()) {
            return;
        }
        for (uint256 i; i < amms.length; i++) {
            amms[i].shutdown();
        }
        emit ShutdownAllAmms(block.number);
    }

    function removeToken(IERC20 _token) external onlyOwner {
        require(isQuoteTokenExisted(_token), "token not existed");

        quoteTokenMap[address(_token)] = false;
        uint256 quoteTokensLength = getQuoteTokenLength();
        for (uint256 i = 0; i < quoteTokensLength; i++) {
            if (quoteTokens[i] == _token) {
                if (i < quoteTokensLength - 1) {
                    quoteTokens[i] = quoteTokens[quoteTokensLength - 1];
                }
                quoteTokens.pop();
                break;
            }
        }

        // exchange and transfer to the quoteToken with the most value. if no more quoteToken, buy protocol tokens
        // TODO use curve or balancer fund token for pooling the fees will be less painful
        if (balanceOf(_token).toUint() > 0) {
            address outputToken = getTokenWithMaxValue();
            if (outputToken == address(0)) {
                outputToken = address(perpToken);
            }
            swapInput(_token, IERC20(outputToken), balanceOf(_token), Decimal.zero());
        }

        emit TokenRemoved(address(_token));
    }

    /**
     * @notice withdraw token to caller
     * @param _amount the amount of quoteToken caller want to withdraw
     */
    function withdraw(IERC20 _quoteToken, Decimal.decimal calldata _amount) external override {
        require(beneficiary == _msgSender(), "caller is not beneficiary");
        require(isQuoteTokenExisted(_quoteToken), "Asset is not supported");

        Decimal.decimal memory quoteBalance = balanceOf(_quoteToken);
        if (_amount.toUint() > quoteBalance.toUint()) {
            Decimal.decimal memory insufficientAmount = _amount.subD(quoteBalance);
            swapEnoughQuoteAmount(_quoteToken, insufficientAmount);
            quoteBalance = balanceOf(_quoteToken);
        }
        require(quoteBalance.toUint() >= _amount.toUint(), "Fund not enough");

        _transfer(_quoteToken, _msgSender(), _amount);
        emit Withdrawn(_msgSender(), _amount.toUint());
    }

    //
    // SETTER
    //

    function setExchange(IExchangeWrapper _exchange) external onlyOwner {
        exchange = _exchange;
    }

    function setBeneficiary(address _beneficiary) external onlyOwner {
        beneficiary = _beneficiary;
    }

    function setMinter(IMinter _minter) public onlyOwner {
        minter = _minter;
        perpToken = minter.getPerpToken();
    }

    function setInflationMonitor(IInflationMonitor _inflationMonitor) external onlyOwner {
        inflationMonitor = _inflationMonitor;
    }

    function getQuoteTokenLength() public view returns (uint256) {
        return quoteTokens.length;
    }

    //
    // INTERNAL FUNCTIONS
    //

    function getTokenWithMaxValue() internal view returns (address) {
        uint256 numOfQuoteTokens = quoteTokens.length;
        if (numOfQuoteTokens == 0) {
            return address(0);
        }
        if (numOfQuoteTokens == 1) {
            return address(quoteTokens[0]);
        }

        IERC20 denominatedToken = quoteTokens[0];
        IERC20 maxValueToken = denominatedToken;
        Decimal.decimal memory valueOfMaxValueToken = balanceOf(denominatedToken);
        for (uint256 i = 1; i < numOfQuoteTokens; i++) {
            IERC20 quoteToken = quoteTokens[i];
            Decimal.decimal memory quoteTokenValue = exchange.getInputPrice(
                quoteToken,
                denominatedToken,
                balanceOf(quoteToken)
            );
            if (quoteTokenValue.cmp(valueOfMaxValueToken) > 0) {
                maxValueToken = quoteToken;
                valueOfMaxValueToken = quoteTokenValue;
            }
        }
        return address(maxValueToken);
    }

    function swapInput(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal memory inputTokenSold,
        Decimal.decimal memory minOutputTokenBought
    ) internal returns (Decimal.decimal memory received) {
        if (inputTokenSold.toUint() == 0) {
            return Decimal.zero();
        }
        _approve(inputToken, address(exchange), inputTokenSold);
        received = exchange.swapInput(inputToken, outputToken, inputTokenSold, minOutputTokenBought, Decimal.zero());
        require(received.toUint() > 0, "Exchange swap error");
    }

    function swapOutput(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal memory outputTokenBought,
        Decimal.decimal memory maxInputTokenSold
    ) internal returns (Decimal.decimal memory received) {
        if (outputTokenBought.toUint() == 0) {
            return Decimal.zero();
        }
        _approve(inputToken, address(exchange), maxInputTokenSold);
        received = exchange.swapOutput(inputToken, outputToken, outputTokenBought, maxInputTokenSold, Decimal.zero());
        require(received.toUint() > 0, "Exchange swap error");
    }

    function swapEnoughQuoteAmount(IERC20 _quoteToken, Decimal.decimal memory _requiredQuoteAmount) internal {
        IERC20[] memory orderedTokens = getOrderedQuoteTokens(_quoteToken);
        for (uint256 i = 0; i < orderedTokens.length; i++) {
            // get how many amount of quote token i is still required
            Decimal.decimal memory swappedQuoteToken;
            Decimal.decimal memory otherQuoteRequiredAmount = exchange.getOutputPrice(
                orderedTokens[i],
                _quoteToken,
                _requiredQuoteAmount
            );

            // if balance of token i can afford the left debt, swap and return
            if (otherQuoteRequiredAmount.toUint() <= balanceOf(orderedTokens[i]).toUint()) {
                swappedQuoteToken = swapInput(orderedTokens[i], _quoteToken, otherQuoteRequiredAmount, Decimal.zero());
                return;
            }

            // if balance of token i can't afford the left debt, show hand and move to the next one
            swappedQuoteToken = swapInput(orderedTokens[i], _quoteToken, balanceOf(orderedTokens[i]), Decimal.zero());
            _requiredQuoteAmount = _requiredQuoteAmount.subD(swappedQuoteToken);
        }

        // if all the quote tokens can't afford the debt, ask staking token to mint
        if (_requiredQuoteAmount.toUint() > 0) {
            Decimal.decimal memory requiredPerpAmount = exchange.getOutputPrice(
                perpToken,
                _quoteToken,
                _requiredQuoteAmount
            );
            minter.mintForLoss(requiredPerpAmount);
            swapInput(perpToken, _quoteToken, requiredPerpAmount, Decimal.zero());
        }
    }

    //
    // VIEW
    //
    function isExistedAmm(IAmm _amm) public view override returns (bool) {
        return ammMap[address(_amm)];
    }

    function getAllAmms() external view override returns (IAmm[] memory) {
        return amms;
    }

    function isQuoteTokenExisted(IERC20 _token) internal view returns (bool) {
        return quoteTokenMap[address(_token)];
    }

    function getOrderedQuoteTokens(IERC20 _exceptionQuoteToken) internal view returns (IERC20[] memory orderedTokens) {
        IERC20[] memory tokens = quoteTokens;
        // insertion sort
        for (uint256 i = 0; i < getQuoteTokenLength(); i++) {
            IERC20 currentToken = quoteTokens[i];
            Decimal.decimal memory currentPerpValue = exchange.getInputPrice(
                currentToken,
                perpToken,
                balanceOf(currentToken)
            );

            for (uint256 j = i; j > 0; j--) {
                Decimal.decimal memory subsetPerpValue = exchange.getInputPrice(
                    tokens[j - 1],
                    perpToken,
                    balanceOf(tokens[j - 1])
                );
                if (currentPerpValue.toUint() > subsetPerpValue.toUint()) {
                    tokens[j] = tokens[j - 1];
                    tokens[j - 1] = currentToken;
                }
            }
        }

        orderedTokens = new IERC20[](tokens.length - 1);
        uint256 j;
        for (uint256 i = 0; i < tokens.length; i++) {
            // jump to the next token
            if (tokens[i] == _exceptionQuoteToken) {
                continue;
            }
            orderedTokens[j] = tokens[i];
            j++;
        }
    }

    function balanceOf(IERC20 _quoteToken) internal view returns (Decimal.decimal memory) {
        return _balanceOf(_quoteToken, address(this));
    }
}
