// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { IERC20 } from "../interface/IERC20.sol";

import { CErc20 } from "./Compound/CTokenInterface.sol";
import { BPool } from "./Balancer/BPool.sol";
import { IExchangeWrapper, Decimal } from "../interface/IExchangeWrapper.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { Decimal, SafeMath } from "../utils/Decimal.sol";

// USDC/USDT decimal 6
// cUSDC/cUSDT decimal 8
contract ExchangeWrapper is PerpFiOwnableUpgrade, IExchangeWrapper, DecimalERC20 {
    using Decimal for Decimal.decimal;
    using SafeMath for *;

    // default max price slippage is 20% of spot price. 12e17 = (1 + 20%) e18
    uint256 private constant DEFAULT_MAX_PRICE_SLIPPAGE = 12e17;

    //
    // EVENTS
    //
    event ExchangeSwap(uint256 perpTokenAmount, uint256 usdtAmount);
    // for debug purpose in the future
    event BalancerSwap(uint256 inAmount, uint256 out);
    event CompoundRedeem(uint256 underlyingAmount, uint256 cTokenAmount);
    event CompoundMint(uint256 underlyingAmount, uint256 cTokenAmount);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//
    BPool public balancerPool;
    CErc20 public compoundCUsdt;
    IERC20 private perpToken;
    IERC20 private usdtToken;
    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(
        address _balancerPool,
        address _compoundCUsdt,
        address _perpToken
    ) external initializer {
        __Ownable_init();

        perpToken = IERC20(_perpToken);
        setBalancerPool(_balancerPool);
        setCompoundCUsdt(_compoundCUsdt);
    }

    function swapInput(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal calldata _inputTokenSold,
        Decimal.decimal calldata _minOutputTokenBought,
        Decimal.decimal calldata _maxPrice
    ) external override returns (Decimal.decimal memory) {
        return implSwapInput(_inputToken, _outputToken, _inputTokenSold, _minOutputTokenBought, _maxPrice);
    }

    function swapOutput(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal calldata _outputTokenBought,
        Decimal.decimal calldata _maxInputTokeSold,
        Decimal.decimal calldata _maxPrice
    ) external override returns (Decimal.decimal memory) {
        return implSwapOutput(_inputToken, _outputToken, _outputTokenBought, _maxInputTokeSold, _maxPrice);
    }

    function getInputPrice(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal calldata _inputTokenSold
    ) external view override returns (Decimal.decimal memory) {
        Decimal.decimal memory spotPrice = implGetSpotPrice(_inputToken, _outputToken);
        return _inputTokenSold.mulD(spotPrice);
    }

    function getOutputPrice(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal calldata _outputTokenBought
    ) external view override returns (Decimal.decimal memory) {
        Decimal.decimal memory spotPrice = implGetSpotPrice(_inputToken, _outputToken);
        return _outputTokenBought.divD(spotPrice);
    }

    function getSpotPrice(IERC20 _inputToken, IERC20 _outputToken)
        external
        view
        override
        returns (Decimal.decimal memory)
    {
        return implGetSpotPrice(_inputToken, _outputToken);
    }

    function approve(
        IERC20 _token,
        address _to,
        Decimal.decimal memory _amount
    ) public onlyOwner {
        _approve(_token, _to, _amount);
    }

    function setBalancerPool(address _balancerPool) public onlyOwner {
        balancerPool = BPool(_balancerPool);
    }

    function setCompoundCUsdt(address _compoundCUsdt) public onlyOwner {
        compoundCUsdt = CErc20(_compoundCUsdt);
        usdtToken = IERC20(compoundCUsdt.underlying());

        // approve cUSDT for redeem/redeemUnderlying
        approve(IERC20(address(compoundCUsdt)), address(compoundCUsdt), Decimal.decimal(uint256(-1)));
        // approve usdt for cUSDT to mint
        approve(usdtToken, address(compoundCUsdt), Decimal.decimal(uint256(-1)));
    }

    //
    // INTERNALS
    //

    function implSwapInput(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal memory _inputTokenSold,
        Decimal.decimal memory _minOutputTokenBought,
        Decimal.decimal memory _maxPrice
    ) internal returns (Decimal.decimal memory outTokenAmount) {
        address sender = _msgSender();
        Decimal.decimal memory inTokenAmount = _inputTokenSold;

        //___0. transfer input token to exchangeWrapper
        _transferFrom(_inputToken, sender, address(this), inTokenAmount);

        // mint cUSDT for Balancer if _inputToken is USDT
        if (isUSDT(_inputToken)) {
            inTokenAmount = compoundMint(inTokenAmount);
        }

        //___1. swap
        IERC20 inToken = balancerAcceptableToken(_inputToken);
        IERC20 outToken = balancerAcceptableToken(_outputToken);
        outTokenAmount = balancerSwapIn(inToken, outToken, inTokenAmount, _minOutputTokenBought, _maxPrice);

        // if _outputToken is USDT redeem cUSDT to USDT
        if (isUSDT(_outputToken)) {
            outTokenAmount = compoundRedeem(outTokenAmount);
        }
        emit ExchangeSwap(_inputTokenSold.toUint(), outTokenAmount.toUint());

        //___2. transfer back to sender
        _transfer(_outputToken, sender, outTokenAmount);
    }

    function implSwapOutput(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal memory _outputTokenBought,
        Decimal.decimal memory _maxInputTokenSold,
        Decimal.decimal memory _maxPrice
    ) internal returns (Decimal.decimal memory) {
        address sender = _msgSender();
        Decimal.decimal memory outTokenBought = _outputTokenBought;

        //___0. if _outputToken is USDT, get cUSDT amount for Balancer
        if (isUSDT(_outputToken)) {
            outTokenBought = compoundCTokenAmount(outTokenBought);
        }

        IERC20 inToken = balancerAcceptableToken(_inputToken);
        IERC20 outToken = balancerAcceptableToken(_outputToken);
        //___1. calc how much input tokens needed by given outTokenBought,
        Decimal.decimal memory expectedTokenInAmount = calcBalancerInGivenOut(
            address(inToken),
            address(outToken),
            outTokenBought
        );
        require(_maxInputTokenSold.cmp(expectedTokenInAmount) >= 0, "max input amount less than expected");

        //___2 transfer input tokens to exchangeWrapper
        // if _inputToken is USDT, mint cUSDT for Balancer
        if (isUSDT(_inputToken)) {
            Decimal.decimal memory underlyingAmount = compoundUnderlyingAmount(expectedTokenInAmount);
            _transferFrom(_inputToken, sender, address(this), underlyingAmount);
            compoundMint(underlyingAmount);
        } else {
            _transferFrom(_inputToken, sender, address(this), expectedTokenInAmount);
        }

        //___3. swap
        Decimal.decimal memory requiredInAmount = balancerSwapOut(
            inToken,
            outToken,
            outTokenBought,
            _maxInputTokenSold,
            _maxPrice
        );

        // if _outputToken is USDT, redeem cUSDT to USDT
        if (isUSDT(_outputToken)) {
            compoundRedeemUnderlying(_outputTokenBought);
        }
        emit ExchangeSwap(requiredInAmount.toUint(), _outputTokenBought.toUint());

        //___4. transfer back to sender
        _transfer(_outputToken, sender, _outputTokenBought);

        return requiredInAmount;
    }

    function balancerSwapIn(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal memory _inputTokenSold,
        Decimal.decimal memory _minOutputTokenBought,
        Decimal.decimal memory _maxPrice
    ) internal returns (Decimal.decimal memory) {
        // if max price is 0, set to (DEFAULT_MAX_PRICE_SLIPPAGE x spot price)
        if (_maxPrice.toUint() == 0) {
            uint256 spotPrice = balancerPool.getSpotPrice(address(_inputToken), address(_outputToken));
            _maxPrice = Decimal.decimal(spotPrice).mulD(Decimal.decimal(DEFAULT_MAX_PRICE_SLIPPAGE));
        }
        _approve(IERC20(_inputToken), address(balancerPool), _inputTokenSold);

        // swap
        uint256 tokeSold = _toUint(_inputToken, _inputTokenSold);
        (uint256 outAmountInSelfDecimals, ) = balancerPool.swapExactAmountIn(
            address(_inputToken),
            tokeSold,
            address(_outputToken),
            _toUint(_outputToken, _minOutputTokenBought),
            _maxPrice.toUint()
        );
        require(outAmountInSelfDecimals > 0, "Balancer exchange error");
        emit BalancerSwap(tokeSold, outAmountInSelfDecimals);

        return _toDecimal(_outputToken, outAmountInSelfDecimals);
    }

    function balancerSwapOut(
        IERC20 _inputToken,
        IERC20 _outputToken,
        Decimal.decimal memory _outputTokenBought,
        Decimal.decimal memory _maxInputTokenSold,
        Decimal.decimal memory _maxPrice
    ) internal returns (Decimal.decimal memory tokenAmountIn) {
        // if max price is 0, set to (DEFAULT_MAX_PRICE_SLIPPAGE x spot price)
        if (_maxPrice.toUint() == 0) {
            uint256 spotPrice = balancerPool.getSpotPrice(address(_inputToken), address(_outputToken));
            _maxPrice = Decimal.decimal(spotPrice).mulD(Decimal.decimal(DEFAULT_MAX_PRICE_SLIPPAGE));
        }
        _approve(IERC20(_inputToken), address(balancerPool), _maxInputTokenSold);

        // swap
        uint256 tokenBought = _toUint(_outputToken, _outputTokenBought);
        uint256 maxTokenSold = _toUint(_inputToken, _maxInputTokenSold);
        (uint256 inAmountInSelfDecimals, ) = balancerPool.swapExactAmountOut(
            address(_inputToken),
            maxTokenSold,
            address(_outputToken),
            tokenBought,
            _maxPrice.toUint()
        );
        require(inAmountInSelfDecimals > 0, "Balancer exchange error");
        emit BalancerSwap(inAmountInSelfDecimals, tokenBought);

        return _toDecimal(_inputToken, inAmountInSelfDecimals);
    }

    function compoundMint(Decimal.decimal memory _underlyingAmount)
        internal
        returns (Decimal.decimal memory mintedAmount)
    {
        // https://compound.finance/docs/ctokens#mint
        uint256 underlyingAmountInSelfDecimals = _toUint(usdtToken, _underlyingAmount);
        require(compoundCUsdt.mint(underlyingAmountInSelfDecimals) == 0, "Compound mint error");

        mintedAmount = compoundCTokenAmount(_underlyingAmount);
        uint256 cTokenAmountIn8Decimals = _toUint(IERC20(address(compoundCUsdt)), mintedAmount);
        emit CompoundMint(underlyingAmountInSelfDecimals, cTokenAmountIn8Decimals);
    }

    function compoundRedeem(Decimal.decimal memory _cTokenAmount)
        internal
        returns (Decimal.decimal memory outUnderlyingAmount)
    {
        // https://compound.finance/docs/ctokens#redeem
        uint256 cTokenAmountIn8Decimals = _toUint(IERC20(address(compoundCUsdt)), _cTokenAmount);
        require(compoundCUsdt.redeem(cTokenAmountIn8Decimals) == 0, "Compound redeem error");

        outUnderlyingAmount = compoundUnderlyingAmount(_cTokenAmount);
        uint256 underlyingAmountInSelfDecimals = _toUint(usdtToken, outUnderlyingAmount);
        emit CompoundRedeem(underlyingAmountInSelfDecimals, cTokenAmountIn8Decimals);
    }

    function compoundRedeemUnderlying(Decimal.decimal memory _underlyingAmount)
        internal
        returns (Decimal.decimal memory outCTokenAmount)
    {
        // https://compound.finance/docs/ctokens#redeem-underlying
        uint256 underlyingTokenIn6Decimals = _toUint(usdtToken, _underlyingAmount);
        require(compoundCUsdt.redeemUnderlying(underlyingTokenIn6Decimals) == 0, "Compound redeemUnderlying error");

        outCTokenAmount = compoundCTokenAmount(_underlyingAmount);
        uint256 cTokenAmountIn8Decimals = _toUint(IERC20(address(compoundCUsdt)), outCTokenAmount);
        emit CompoundRedeem(underlyingTokenIn6Decimals, cTokenAmountIn8Decimals);
    }

    function compoundUnderlyingAmount(Decimal.decimal memory _cTokenAmount)
        internal
        view
        returns (Decimal.decimal memory underlyingAmount)
    {
        // The current exchange rate as an unsigned integer, scaled by 1e18.
        // ** calculation of decimals between tokens is under exchangeRateStored()
        uint256 exchangeRate = compoundCUsdt.exchangeRateStored();
        uint256 cTokenIn8Decimals = _toUint(IERC20(address(compoundCUsdt)), _cTokenAmount);

        // The amount of underlying tokens received is equal to the quantity of cTokens,
        // multiplied by the current Exchange Rate
        Decimal.decimal memory underlyingTokenIn6Decimals = Decimal.decimal(cTokenIn8Decimals).mulD(
            Decimal.decimal(exchangeRate)
        );
        underlyingAmount = _toDecimal(usdtToken, underlyingTokenIn6Decimals.toUint());
    }

    function compoundCTokenAmount(Decimal.decimal memory _underlyingAmount)
        internal
        view
        returns (Decimal.decimal memory cTokenAmount)
    {
        // The current exchange rate as an unsigned integer, scaled by 1e18.
        // ** calculation of decimals between tokens is under exchangeRateStored()
        uint256 exchangeRate = compoundCUsdt.exchangeRateStored();
        uint256 underlyingTokenIn6Decimals = _toUint(usdtToken, _underlyingAmount);

        // The amount of cTokens is equal to the quantity of underlying tokens received,
        // divided by the current Exchange Rate
        uint256 cTokenIn8Decimals = Decimal
            .decimal(underlyingTokenIn6Decimals)
            .divD(Decimal.decimal(exchangeRate))
            .toUint();
        cTokenAmount = _toDecimal(IERC20(address(compoundCUsdt)), cTokenIn8Decimals);
    }

    function balancerAcceptableToken(IERC20 _token) internal view returns (IERC20) {
        if (isUSDT(_token)) {
            return IERC20(address(compoundCUsdt));
        }
        return _token;
    }

    function calcBalancerInGivenOut(
        address _inToken,
        address _outToken,
        Decimal.decimal memory _givenOutAmount
    ) internal view returns (Decimal.decimal memory) {
        uint256 givenOut = _toUint(IERC20(_outToken), _givenOutAmount);
        uint256 inWeight = balancerPool.getDenormalizedWeight(_inToken);
        uint256 outWeight = balancerPool.getDenormalizedWeight(_outToken);
        uint256 inBalance = balancerPool.getBalance(_inToken);
        uint256 outBalance = balancerPool.getBalance(_outToken);
        uint256 expectedTokenInAmount = balancerPool.calcInGivenOut(
            inBalance,
            inWeight,
            outBalance,
            outWeight,
            givenOut,
            balancerPool.getSwapFee()
        );
        return _toDecimal(IERC20(_inToken), expectedTokenInAmount);
    }

    function implGetSpotPrice(IERC20 _inputToken, IERC20 _outputToken) internal view returns (Decimal.decimal memory) {
        if (_inputToken == _outputToken) return Decimal.one();

        IERC20 inToken = balancerAcceptableToken(_inputToken);
        IERC20 outToken = balancerAcceptableToken(_outputToken);
        uint256 spotPrice = balancerPool.getSpotPrice(address(inToken), address(outToken));

        // the amount returned from getSpotPrice includes decimals difference between tokens.
        // for example, input/output token pair, USDC(8 decimals)/PERP(18 decimals) and 2 USDC buy 1 PERP,
        // it returns 0.5e-10*e18, in the other direction(PERP/USDC), it returns 2e10*e18
        Decimal.decimal memory price = Decimal.decimal(spotPrice);
        uint256 decimalsOfInput = _getTokenDecimals(address(inToken));
        uint256 decimalsOfOutput = _getTokenDecimals(address(outToken));
        if (decimalsOfInput < decimalsOfOutput) {
            price = _toDecimal(inToken, price.toUint());
        } else if (decimalsOfInput > decimalsOfOutput) {
            price = Decimal.decimal(_toUint(outToken, price));
        }

        // compoundUnderlyingAmount gets n underlying tokens by given m cTokens
        // if input token is USDT, spot price is 0.5(cUSDT/PERP). The price of USDT/PERP would be 0.5 x n
        // if output token is USDT, spot price is 2(PERP/cUSDT) then price is 2/n
        if (isUSDT(_inputToken)) {
            return price.mulD(compoundUnderlyingAmount(Decimal.one()));
        } else if (isUSDT(_outputToken)) {
            return price.divD(compoundUnderlyingAmount(Decimal.one()));
        }
        return price;
    }

    function isUSDT(IERC20 _token) internal view returns (bool) {
        if (usdtToken == _token) {
            return true;
        }
        return false;
    }
}
