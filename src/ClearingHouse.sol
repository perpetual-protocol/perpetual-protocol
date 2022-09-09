// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { BlockContext } from "./utils/BlockContext.sol";
import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { SignedDecimal } from "./utils/SignedDecimal.sol";
import { MixedDecimal } from "./utils/MixedDecimal.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { ContextUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
// prettier-ignore
// solhint-disable-next-line
import { ReentrancyGuardUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import { OwnerPausableUpgradeSafe } from "./OwnerPausable.sol";
import { IAmm } from "./interface/IAmm.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { IMultiTokenRewardRecipient } from "./interface/IMultiTokenRewardRecipient.sol";

// note BaseRelayRecipient must come after OwnerPausableUpgradeSafe so its _msgSender() takes precedence
// (yes, the ordering is reversed comparing to Python)
contract ClearingHouse is
    DecimalERC20,
    OwnerPausableUpgradeSafe,
    ReentrancyGuardUpgradeSafe,
    BlockContext,
    BaseRelayRecipient
{
    using Decimal for Decimal.decimal;
    using SignedDecimal for SignedDecimal.signedDecimal;
    using MixedDecimal for SignedDecimal.signedDecimal;

    //
    // EVENTS
    //
    event MarginRatioChanged(uint256 marginRatio);
    event LiquidationFeeRatioChanged(uint256 liquidationFeeRatio);
    event BackstopLiquidityProviderChanged(address indexed account, bool indexed isProvider);
    event MarginChanged(address indexed sender, address indexed amm, int256 amount, int256 fundingPayment);
    event PositionAdjusted(
        address indexed amm,
        address indexed trader,
        int256 newPositionSize,
        uint256 oldLiquidityIndex,
        uint256 newLiquidityIndex
    );
    event PositionSettled(address indexed amm, address indexed trader, uint256 valueTransferred);
    event RestrictionModeEntered(address amm, uint256 blockNumber);

    /// @notice This event is emitted when position change
    /// @param trader the address which execute this transaction
    /// @param amm IAmm address
    /// @param margin margin
    /// @param positionNotional margin * leverage
    /// @param exchangedPositionSize position size, e.g. ETHUSDC or LINKUSDC
    /// @param fee transaction fee
    /// @param positionSizeAfter position size after this transaction, might be increased or decreased
    /// @param realizedPnl realized pnl after this position changed
    /// @param unrealizedPnlAfter unrealized pnl after this position changed
    /// @param badDebt position change amount cleared by insurance funds
    /// @param liquidationPenalty amount of remaining margin lost due to liquidation
    /// @param spotPrice quote asset reserve / base asset reserve
    /// @param fundingPayment funding payment (+: trader paid, -: trader received)
    event PositionChanged(
        address indexed trader,
        address indexed amm,
        uint256 margin,
        uint256 positionNotional,
        int256 exchangedPositionSize,
        uint256 fee,
        int256 positionSizeAfter,
        int256 realizedPnl,
        int256 unrealizedPnlAfter,
        uint256 badDebt,
        uint256 liquidationPenalty,
        uint256 spotPrice,
        int256 fundingPayment
    );

    /// @notice This event is emitted when position liquidated
    /// @param trader the account address being liquidated
    /// @param amm IAmm address
    /// @param positionNotional liquidated position value minus liquidationFee
    /// @param positionSize liquidated position size
    /// @param liquidationFee liquidation fee to the liquidator
    /// @param liquidator the address which execute this transaction
    /// @param badDebt liquidation fee amount cleared by insurance funds
    event PositionLiquidated(
        address indexed trader,
        address indexed amm,
        uint256 positionNotional,
        uint256 positionSize,
        uint256 liquidationFee,
        address liquidator,
        uint256 badDebt
    );

    event ReferredPositionChanged(bytes32 indexed referralCode);

    //
    // Struct and Enum
    //

    enum Side { BUY, SELL }
    enum PnlCalcOption { SPOT_PRICE, TWAP, ORACLE }

    /// @param MAX_PNL most beneficial way for traders to calculate position notional
    /// @param MIN_PNL least beneficial way for traders to calculate position notional
    enum PnlPreferenceOption { MAX_PNL, MIN_PNL }

    /// @notice This struct records personal position information
    /// @param size denominated in amm.baseAsset
    /// @param margin isolated margin
    /// @param openNotional the quoteAsset value of position when opening position. the cost of the position
    /// @param lastUpdatedCumulativePremiumFraction for calculating funding payment, record at the moment every time when trader open/reduce/close position
    /// @param liquidityHistoryIndex
    /// @param blockNumber the block number of the last position
    struct Position {
        SignedDecimal.signedDecimal size;
        Decimal.decimal margin;
        Decimal.decimal openNotional;
        SignedDecimal.signedDecimal lastUpdatedCumulativePremiumFraction;
        uint256 liquidityHistoryIndex;
        uint256 blockNumber;
    }

    /// @notice This struct is used for avoiding stack too deep error when passing too many var between functions
    struct PositionResp {
        Position position;
        // the quote asset amount trader will send if open position, will receive if close
        Decimal.decimal exchangedQuoteAssetAmount;
        // if realizedPnl + realizedFundingPayment + margin is negative, it's the abs value of it
        Decimal.decimal badDebt;
        // the base asset amount trader will receive if open position, will send if close
        SignedDecimal.signedDecimal exchangedPositionSize;
        // funding payment incurred during this position response
        SignedDecimal.signedDecimal fundingPayment;
        // realizedPnl = unrealizedPnl * closedRatio
        SignedDecimal.signedDecimal realizedPnl;
        // positive = trader transfer margin to vault, negative = trader receive margin from vault
        // it's 0 when internalReducePosition, its addedMargin when internalIncreasePosition
        // it's min(0, oldPosition + realizedFundingPayment + realizedPnl) when internalClosePosition
        SignedDecimal.signedDecimal marginToVault;
        // unrealized pnl after open position
        SignedDecimal.signedDecimal unrealizedPnlAfter;
    }

    struct AmmMap {
        // issue #1471
        // last block when it turn restriction mode on.
        // In restriction mode, no one can do multi open/close/liquidate position in the same block.
        // If any underwater position being closed (having a bad debt and make insuranceFund loss),
        // or any liquidation happened,
        // restriction mode is ON in that block and OFF(default) in the next block.
        // This design is to prevent the attacker being benefited from the multiple action in one block
        // in extreme cases
        uint256 lastRestrictionBlock;
        SignedDecimal.signedDecimal[] cumulativePremiumFractions;
        mapping(address => Position) positionMap;
    }

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//
    string public override versionRecipient;

    // only admin
    Decimal.decimal public initMarginRatio;

    // only admin
    Decimal.decimal public maintenanceMarginRatio;

    // only admin
    Decimal.decimal public liquidationFeeRatio;

    // key by amm address. will be deprecated or replaced after guarded period.
    // it's not an accurate open interest, just a rough way to control the unexpected loss at the beginning
    mapping(address => Decimal.decimal) public openInterestNotionalMap;

    // key by amm address
    mapping(address => AmmMap) internal ammMap;

    // prepaid bad debt balance, key by ERC20 token address
    mapping(address => Decimal.decimal) internal prepaidBadDebt;

    // contract dependencies
    IInsuranceFund public insuranceFund;
    IMultiTokenRewardRecipient public feePool;

    // designed for arbitragers who can hold unlimited positions. will be removed after guarded period
    address internal whitelist;

    uint256[50] private __gap;
    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//
    Decimal.decimal public partialLiquidationRatio;

    mapping(address => bool) public backstopLiquidityProviderMap;

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    //

    // FUNCTIONS
    //
    // openzeppelin doesn't support struct input
    // https://github.com/OpenZeppelin/openzeppelin-sdk/issues/1523
    function initialize(
        uint256 _initMarginRatio,
        uint256 _maintenanceMarginRatio,
        uint256 _liquidationFeeRatio,
        IInsuranceFund _insuranceFund,
        address _trustedForwarder
    ) public initializer {
        require(address(_insuranceFund) != address(0), "Invalid IInsuranceFund");

        __OwnerPausable_init();

        // comment these out for reducing bytecode size
        __ReentrancyGuard_init();

        versionRecipient = "1.0.0"; // we are not using it atm
        initMarginRatio = Decimal.decimal(_initMarginRatio);
        maintenanceMarginRatio = Decimal.decimal(_maintenanceMarginRatio);
        liquidationFeeRatio = Decimal.decimal(_liquidationFeeRatio);
        insuranceFund = _insuranceFund;
        trustedForwarder = _trustedForwarder;
    }

    //
    // External
    //

    /**
     * @notice set liquidation fee ratio
     * @dev only owner can call
     * @param _liquidationFeeRatio new liquidation fee ratio in 18 digits
     */
    function setLiquidationFeeRatio(Decimal.decimal memory _liquidationFeeRatio) external onlyOwner {
        liquidationFeeRatio = _liquidationFeeRatio;
        emit LiquidationFeeRatioChanged(liquidationFeeRatio.toUint());
    }

    /**
     * @notice set maintenance margin ratio
     * @dev only owner can call
     * @param _maintenanceMarginRatio new maintenance margin ratio in 18 digits
     */
    function setMaintenanceMarginRatio(Decimal.decimal memory _maintenanceMarginRatio) external onlyOwner {
        maintenanceMarginRatio = _maintenanceMarginRatio;
        emit MarginRatioChanged(maintenanceMarginRatio.toUint());
    }

    /**
     * @notice set the toll pool address
     * @dev only owner can call
     */
    function setTollPool(address _feePool) external onlyOwner {
        feePool = IMultiTokenRewardRecipient(_feePool);
    }

    /**
     * @notice add an address in the whitelist. People in the whitelist can hold unlimited positions.
     * @dev only owner can call
     * @param _whitelist an address
     */
    function setWhitelist(address _whitelist) external onlyOwner {
        whitelist = _whitelist;
    }

    /**
     * @notice set backstop liquidity provider
     * @dev only owner can call
     * @param account provider address
     * @param isProvider wether the account is a backstop liquidity provider
     */
    function setBackstopLiquidityProvider(address account, bool isProvider) external onlyOwner {
        backstopLiquidityProviderMap[account] = isProvider;
        emit BackstopLiquidityProviderChanged(account, isProvider);
    }

    /**
     * @notice set the margin ratio after deleveraging
     * @dev only owner can call
     */
    function setPartialLiquidationRatio(Decimal.decimal memory _ratio) external onlyOwner {
        require(_ratio.cmp(Decimal.one()) <= 0, "invalid partial liquidation ratio");
        partialLiquidationRatio = _ratio;
    }

    /**
     * @notice add margin to increase margin ratio
     * @param _amm IAmm address
     * @param _addedMargin added margin in 18 digits
     */
    function addMargin(IAmm _amm, Decimal.decimal calldata _addedMargin) external whenNotPaused() nonReentrant() {
        // check condition
        requireAmm(_amm, true);
        IERC20 quoteToken = _amm.quoteAsset();
        requireValidTokenAmount(quoteToken, _addedMargin);

        address trader = _msgSender();
        Position memory position = getPosition(_amm, trader);
        // update margin
        position.margin = position.margin.addD(_addedMargin);

        setPosition(_amm, trader, position);
        // transfer token from trader
        _transferFrom(quoteToken, trader, address(this), _addedMargin);
        emit MarginChanged(trader, address(_amm), int256(_addedMargin.toUint()), 0);
    }

    /**
     * @notice remove margin to decrease margin ratio
     * @param _amm IAmm address
     * @param _removedMargin removed margin in 18 digits
     */
    function removeMargin(IAmm _amm, Decimal.decimal calldata _removedMargin) external whenNotPaused() nonReentrant() {
        // check condition
        requireAmm(_amm, true);
        IERC20 quoteToken = _amm.quoteAsset();
        requireValidTokenAmount(quoteToken, _removedMargin);

        address trader = _msgSender();
        // realize funding payment if there's no bad debt
        Position memory position = getPosition(_amm, trader);

        // update margin and cumulativePremiumFraction
        SignedDecimal.signedDecimal memory marginDelta = MixedDecimal.fromDecimal(_removedMargin).mulScalar(-1);
        (
            Decimal.decimal memory remainMargin,
            Decimal.decimal memory badDebt,
            SignedDecimal.signedDecimal memory fundingPayment,
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
        ) = calcRemainMarginWithFundingPayment(_amm, position, marginDelta);
        require(badDebt.toUint() == 0, "margin is not enough");
        position.margin = remainMargin;
        position.lastUpdatedCumulativePremiumFraction = latestCumulativePremiumFraction;

        // check enough margin (same as the way Curie calculates the free collateral)
        // Use a more conservative way to restrict traders to remove their margin
        // We don't allow unrealized PnL to support their margin removal
        require(
            calcFreeCollateral(_amm, trader, remainMargin.subD(badDebt)).toInt() >= 0,
            "free collateral is not enough"
        );

        setPosition(_amm, trader, position);

        // transfer token back to trader
        withdraw(quoteToken, trader, _removedMargin);
        emit MarginChanged(trader, address(_amm), marginDelta.toInt(), fundingPayment.toInt());
    }

    /**
     * @notice settle all the positions when amm is shutdown. The settlement price is according to IAmm.settlementPrice
     * @param _amm IAmm address
     */
    function settlePosition(IAmm _amm) external nonReentrant() {
        // check condition
        requireAmm(_amm, false);
        address trader = _msgSender();
        Position memory pos = getPosition(_amm, trader);
        requirePositionSize(pos.size);
        // update position
        clearPosition(_amm, trader);
        // calculate settledValue
        // If Settlement Price = 0, everyone takes back her collateral.
        // else Returned Fund = Position Size * (Settlement Price - Open Price) + Collateral
        Decimal.decimal memory settlementPrice = _amm.getSettlementPrice();
        Decimal.decimal memory settledValue;
        if (settlementPrice.toUint() == 0) {
            settledValue = pos.margin;
        } else {
            // returnedFund = positionSize * (settlementPrice - openPrice) + positionMargin
            // openPrice = positionOpenNotional / positionSize.abs()
            SignedDecimal.signedDecimal memory returnedFund =
                pos
                    .size
                    .mulD(MixedDecimal.fromDecimal(settlementPrice).subD(pos.openNotional.divD(pos.size.abs())))
                    .addD(pos.margin);
            // if `returnedFund` is negative, trader can't get anything back
            if (returnedFund.toInt() > 0) {
                settledValue = returnedFund.abs();
            }
        }
        // transfer token based on settledValue. no insurance fund support
        if (settledValue.toUint() > 0) {
            _transfer(_amm.quoteAsset(), trader, settledValue);
        }
        // emit event
        emit PositionSettled(address(_amm), trader, settledValue.toUint());
    }

    // if increase position
    //   marginToVault = addMargin
    //   marginDiff = realizedFundingPayment + realizedPnl(0)
    //   pos.margin += marginToVault + marginDiff
    //   vault.margin += marginToVault + marginDiff
    //   required(enoughMarginRatio)
    // else if reduce position()
    //   marginToVault = 0
    //   marginDiff = realizedFundingPayment + realizedPnl
    //   pos.margin += marginToVault + marginDiff
    //   if pos.margin < 0, badDebt = abs(pos.margin), set pos.margin = 0
    //   vault.margin += marginToVault + marginDiff
    //   required(enoughMarginRatio)
    // else if close
    //   marginDiff = realizedFundingPayment + realizedPnl
    //   pos.margin += marginDiff
    //   if pos.margin < 0, badDebt = abs(pos.margin)
    //   marginToVault = -pos.margin
    //   set pos.margin = 0
    //   vault.margin += marginToVault + marginDiff
    // else if close and open a larger position in reverse side
    //   close()
    //   positionNotional -= exchangedQuoteAssetAmount
    //   newMargin = positionNotional / leverage
    //   internalIncreasePosition(newMargin, leverage)
    // else if liquidate
    //   close()
    //   pay liquidation fee to liquidator
    //   move the remain margin to insuranceFund

    /**
     * @notice open a position with referral code
     * @param _amm amm address
     * @param _side enum Side; BUY for long and SELL for short
     * @param _quoteAssetAmount quote asset amount in 18 digits. Can Not be 0
     * @param _leverage leverage  in 18 digits. Can Not be 0
     * @param _baseAssetAmountLimit minimum base asset amount expected to get to prevent from slippage.
     * @param _referralCode referral code
     */
    function openPositionWithReferral(
        IAmm _amm,
        Side _side,
        Decimal.decimal calldata _quoteAssetAmount,
        Decimal.decimal calldata _leverage,
        Decimal.decimal calldata _baseAssetAmountLimit,
        bytes32 _referralCode
    ) external {
        openPosition(_amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit);
        // if (_referralCode != 0) {
        //     emit ReferredPositionChanged(_referralCode);
        // }
    }

    /**
     * @notice open a position
     * @param _amm amm address
     * @param _side enum Side; BUY for long and SELL for short
     * @param _quoteAssetAmount quote asset amount in 18 digits. Can Not be 0
     * @param _leverage leverage  in 18 digits. Can Not be 0
     * @param _baseAssetAmountLimit minimum base asset amount expected to get to prevent from slippage.
     */
    function openPosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit
    ) public whenNotPaused() nonReentrant() {
        requireAmm(_amm, true);
        IERC20 quoteToken = _amm.quoteAsset();
        requireValidTokenAmount(quoteToken, _quoteAssetAmount);
        requireNonZeroInput(_leverage);
        requireMoreMarginRatio(MixedDecimal.fromDecimal(Decimal.one()).divD(_leverage), initMarginRatio, true);
        requireNotRestrictionMode(_amm);

        address trader = _msgSender();
        PositionResp memory positionResp;
        {
            // add scope for stack too deep error
            int256 oldPositionSize = getPosition(_amm, trader).size.toInt();
            bool isNewPosition = oldPositionSize == 0 ? true : false;

            // increase or decrease position depends on old position's side and size
            if (isNewPosition || (oldPositionSize > 0 ? Side.BUY : Side.SELL) == _side) {
                positionResp = internalIncreasePosition(
                    _amm,
                    _side,
                    _quoteAssetAmount.mulD(_leverage),
                    _baseAssetAmountLimit,
                    _leverage
                );
            } else {
                positionResp = openReversePosition(
                    _amm,
                    _side,
                    trader,
                    _quoteAssetAmount,
                    _leverage,
                    _baseAssetAmountLimit,
                    false
                );
            }

            // update the position state
            setPosition(_amm, trader, positionResp.position);
            // if opening the exact position size as the existing one == closePosition, can skip the margin ratio check
            if (!isNewPosition && positionResp.position.size.toInt() != 0) {
                requireMoreMarginRatio(getMarginRatio(_amm, trader), maintenanceMarginRatio, true);
            }

            // to prevent attacker to leverage the bad debt to withdraw extra token from insurance fund
            require(positionResp.badDebt.toUint() == 0, "bad debt");

            // transfer the actual token between trader and vault
            if (positionResp.marginToVault.toInt() > 0) {
                _transferFrom(quoteToken, trader, address(this), positionResp.marginToVault.abs());
            } else if (positionResp.marginToVault.toInt() < 0) {
                withdraw(quoteToken, trader, positionResp.marginToVault.abs());
            }
        }

        // calculate fee and transfer token for fees
        //@audit - can optimize by changing amm.swapInput/swapOutput's return type to (exchangedAmount, quoteToll, quoteSpread, quoteReserve, baseReserve) (@wraecca)
        Decimal.decimal memory transferredFee = transferFee(trader, _amm, positionResp.exchangedQuoteAssetAmount);

        // emit event
        uint256 spotPrice = _amm.getSpotPrice().toUint();
        int256 fundingPayment = positionResp.fundingPayment.toInt(); // pre-fetch for stack too deep error
        emit PositionChanged(
            trader,
            address(_amm),
            positionResp.position.margin.toUint(),
            positionResp.exchangedQuoteAssetAmount.toUint(),
            positionResp.exchangedPositionSize.toInt(),
            transferredFee.toUint(),
            positionResp.position.size.toInt(),
            positionResp.realizedPnl.toInt(),
            positionResp.unrealizedPnlAfter.toInt(),
            positionResp.badDebt.toUint(),
            0,
            spotPrice,
            fundingPayment
        );
    }

    /**
     * @notice close position with referral code
     * @param _amm IAmm address
     * @param _referralCode referral code
     */
    function closePositionWithReferral(
        IAmm _amm,
        Decimal.decimal calldata _quoteAssetAmountLimit,
        bytes32 _referralCode
    ) external {
        closePosition(_amm, _quoteAssetAmountLimit);
        // if (_referralCode != 0) {
        //     emit ReferredPositionChanged(_referralCode);
        // }
    }

    /**
     * @notice close all the positions
     * @param _amm IAmm address
     */
    function closePosition(IAmm _amm, Decimal.decimal memory _quoteAssetAmountLimit)
        public
        whenNotPaused()
        nonReentrant()
    {
        // check conditions
        requireAmm(_amm, true);
        requireNotRestrictionMode(_amm);

        // update position
        address trader = _msgSender();

        PositionResp memory positionResp;
        {
            Position memory position = getPosition(_amm, trader);
            // if it is long position, close a position means short it(which means base dir is ADD_TO_AMM) and vice versa
            IAmm.Dir dirOfBase = position.size.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM;

            // check if this position exceed fluctuation limit
            // if over fluctuation limit, then close partial position. Otherwise close all.
            // if partialLiquidationRatio is 1, then close whole position
            if (
                _amm.isOverFluctuationLimit(dirOfBase, position.size.abs()) &&
                partialLiquidationRatio.cmp(Decimal.one()) < 0
            ) {
                Decimal.decimal memory partiallyClosedPositionNotional =
                    _amm.getOutputPrice(dirOfBase, position.size.mulD(partialLiquidationRatio).abs());

                positionResp = openReversePosition(
                    _amm,
                    position.size.toInt() > 0 ? Side.SELL : Side.BUY,
                    trader,
                    partiallyClosedPositionNotional,
                    Decimal.one(),
                    Decimal.zero(),
                    true
                );
                setPosition(_amm, trader, positionResp.position);
            } else {
                positionResp = internalClosePosition(_amm, trader, _quoteAssetAmountLimit);
            }

            // to prevent attacker to leverage the bad debt to withdraw extra token from insurance fund
            require(positionResp.badDebt.toUint() == 0, "bad debt");

            // add scope for stack too deep error
            // transfer the actual token from trader and vault
            IERC20 quoteToken = _amm.quoteAsset();
            withdraw(quoteToken, trader, positionResp.marginToVault.abs());
        }

        // calculate fee and transfer token for fees
        Decimal.decimal memory transferredFee = transferFee(trader, _amm, positionResp.exchangedQuoteAssetAmount);

        // prepare event
        uint256 spotPrice = _amm.getSpotPrice().toUint();
        int256 fundingPayment = positionResp.fundingPayment.toInt();
        emit PositionChanged(
            trader,
            address(_amm),
            positionResp.position.margin.toUint(),
            positionResp.exchangedQuoteAssetAmount.toUint(),
            positionResp.exchangedPositionSize.toInt(),
            transferredFee.toUint(),
            positionResp.position.size.toInt(),
            positionResp.realizedPnl.toInt(),
            positionResp.unrealizedPnlAfter.toInt(),
            positionResp.badDebt.toUint(),
            0,
            spotPrice,
            fundingPayment
        );
    }

    function liquidateWithSlippage(
        IAmm _amm,
        address _trader,
        Decimal.decimal memory _quoteAssetAmountLimit
    ) external nonReentrant() returns (Decimal.decimal memory quoteAssetAmount, bool isPartialClose) {
        Position memory position = getPosition(_amm, _trader);
        (quoteAssetAmount, isPartialClose) = internalLiquidate(_amm, _trader);

        Decimal.decimal memory quoteAssetAmountLimit =
            isPartialClose ? _quoteAssetAmountLimit.mulD(partialLiquidationRatio) : _quoteAssetAmountLimit;

        if (position.size.toInt() > 0) {
            require(quoteAssetAmount.toUint() >= quoteAssetAmountLimit.toUint(), "Less than minimal quote token");
        } else if (position.size.toInt() < 0 && quoteAssetAmountLimit.cmp(Decimal.zero()) != 0) {
            require(quoteAssetAmount.toUint() <= quoteAssetAmountLimit.toUint(), "More than maximal quote token");
        }

        return (quoteAssetAmount, isPartialClose);
    }

    /**
     * @notice liquidate trader's underwater position. Require trader's margin ratio less than maintenance margin ratio
     * @dev liquidator can NOT open any positions in the same block to prevent from price manipulation.
     * @param _amm IAmm address
     * @param _trader trader address
     */
    function liquidate(IAmm _amm, address _trader) public nonReentrant() {
        internalLiquidate(_amm, _trader);
    }

    /**
     * @notice if funding rate is positive, traders with long position pay traders with short position and vice versa.
     * @param _amm IAmm address
     */
    function payFunding(IAmm _amm) external {
        requireAmm(_amm, true);

        SignedDecimal.signedDecimal memory premiumFraction = _amm.settleFunding();
        ammMap[address(_amm)].cumulativePremiumFractions.push(
            premiumFraction.addD(getLatestCumulativePremiumFraction(_amm))
        );

        // funding payment = premium fraction * position
        // eg. if alice takes 10 long position, totalPositionSize = 10
        // if premiumFraction is positive: long pay short, amm get positive funding payment
        // if premiumFraction is negative: short pay long, amm get negative funding payment
        // if totalPositionSize.side * premiumFraction > 0, funding payment is positive which means profit
        SignedDecimal.signedDecimal memory totalTraderPositionSize = _amm.getBaseAssetDelta();
        SignedDecimal.signedDecimal memory ammFundingPaymentProfit = premiumFraction.mulD(totalTraderPositionSize);

        IERC20 quoteAsset = _amm.quoteAsset();
        if (ammFundingPaymentProfit.toInt() < 0) {
            insuranceFund.withdraw(quoteAsset, ammFundingPaymentProfit.abs());
        } else {
            transferToInsuranceFund(quoteAsset, ammFundingPaymentProfit.abs());
        }
    }

    //
    // VIEW FUNCTIONS
    //

    /**
     * @notice get margin ratio, marginRatio = (margin + funding payment + unrealized Pnl) / positionNotional
     * use spot and twap price to calculate unrealized Pnl, final unrealized Pnl depends on which one is higher
     * @param _amm IAmm address
     * @param _trader trader address
     * @return margin ratio in 18 digits
     */
    function getMarginRatio(IAmm _amm, address _trader) public view returns (SignedDecimal.signedDecimal memory) {
        Position memory position = getPosition(_amm, _trader);
        requirePositionSize(position.size);
        (SignedDecimal.signedDecimal memory unrealizedPnl, Decimal.decimal memory positionNotional) =
            getPreferencePositionNotionalAndUnrealizedPnl(_amm, _trader, PnlPreferenceOption.MAX_PNL);
        return _getMarginRatio(_amm, position, unrealizedPnl, positionNotional);
    }

    function _getMarginRatioByCalcOption(
        IAmm _amm,
        address _trader,
        PnlCalcOption _pnlCalcOption
    ) internal view returns (SignedDecimal.signedDecimal memory) {
        Position memory position = getPosition(_amm, _trader);
        requirePositionSize(position.size);
        (Decimal.decimal memory positionNotional, SignedDecimal.signedDecimal memory pnl) =
            getPositionNotionalAndUnrealizedPnl(_amm, _trader, _pnlCalcOption);
        return _getMarginRatio(_amm, position, pnl, positionNotional);
    }

    function _getMarginRatio(
        IAmm _amm,
        Position memory _position,
        SignedDecimal.signedDecimal memory _unrealizedPnl,
        Decimal.decimal memory _positionNotional
    ) internal view returns (SignedDecimal.signedDecimal memory) {
        (Decimal.decimal memory remainMargin, Decimal.decimal memory badDebt, , ) =
            calcRemainMarginWithFundingPayment(_amm, _position, _unrealizedPnl);
        return MixedDecimal.fromDecimal(remainMargin).subD(badDebt).divD(_positionNotional);
    }

    /**
     * @notice get personal position information
     * @param _amm IAmm address
     * @param _trader trader address
     * @return struct Position
     */
    function getPosition(IAmm _amm, address _trader) public view returns (Position memory) {
        return ammMap[address(_amm)].positionMap[_trader];
    }

    /**
     * @notice get position notional and unrealized Pnl without fee expense and funding payment
     * @param _amm IAmm address
     * @param _trader trader address
     * @param _pnlCalcOption enum PnlCalcOption, SPOT_PRICE for spot price and TWAP for twap price
     * @return positionNotional position notional
     * @return unrealizedPnl unrealized Pnl
     */
    function getPositionNotionalAndUnrealizedPnl(
        IAmm _amm,
        address _trader,
        PnlCalcOption _pnlCalcOption
    ) public view returns (Decimal.decimal memory positionNotional, SignedDecimal.signedDecimal memory unrealizedPnl) {
        Position memory position = getPosition(_amm, _trader);
        Decimal.decimal memory positionSizeAbs = position.size.abs();
        if (positionSizeAbs.toUint() != 0) {
            bool isShortPosition = position.size.toInt() < 0;
            IAmm.Dir dir = isShortPosition ? IAmm.Dir.REMOVE_FROM_AMM : IAmm.Dir.ADD_TO_AMM;
            if (_pnlCalcOption == PnlCalcOption.TWAP) {
                positionNotional = _amm.getOutputTwap(dir, positionSizeAbs);
            } else if (_pnlCalcOption == PnlCalcOption.SPOT_PRICE) {
                positionNotional = _amm.getOutputPrice(dir, positionSizeAbs);
            } else {
                Decimal.decimal memory oraclePrice = _amm.getUnderlyingPrice();
                positionNotional = positionSizeAbs.mulD(oraclePrice);
            }
            // unrealizedPnlForLongPosition = positionNotional - openNotional
            // unrealizedPnlForShortPosition = positionNotionalWhenBorrowed - positionNotionalWhenReturned =
            // openNotional - positionNotional = unrealizedPnlForLongPosition * -1
            unrealizedPnl = isShortPosition
                ? MixedDecimal.fromDecimal(position.openNotional).subD(positionNotional)
                : MixedDecimal.fromDecimal(positionNotional).subD(position.openNotional);
        }
    }

    /**
     * @notice get latest cumulative premium fraction.
     * @param _amm IAmm address
     * @return latest cumulative premium fraction in 18 digits
     */
    function getLatestCumulativePremiumFraction(IAmm _amm) public view returns (SignedDecimal.signedDecimal memory) {
        uint256 len = ammMap[address(_amm)].cumulativePremiumFractions.length;
        if (len > 0) {
            return ammMap[address(_amm)].cumulativePremiumFractions[len - 1];
        }
    }

    //
    // INTERNAL FUNCTIONS
    //

    function enterRestrictionMode(IAmm _amm) internal {
        uint256 blockNumber = _blockNumber();
        ammMap[address(_amm)].lastRestrictionBlock = blockNumber;
        emit RestrictionModeEntered(address(_amm), blockNumber);
    }

    function setPosition(
        IAmm _amm,
        address _trader,
        Position memory _position
    ) internal {
        Position storage positionStorage = ammMap[address(_amm)].positionMap[_trader];
        positionStorage.size = _position.size;
        positionStorage.margin = _position.margin;
        positionStorage.openNotional = _position.openNotional;
        positionStorage.lastUpdatedCumulativePremiumFraction = _position.lastUpdatedCumulativePremiumFraction;
        positionStorage.blockNumber = _position.blockNumber;
        positionStorage.liquidityHistoryIndex = _position.liquidityHistoryIndex;
    }

    function clearPosition(IAmm _amm, address _trader) internal {
        // keep the record in order to retain the last updated block number
        ammMap[address(_amm)].positionMap[_trader] = Position({
            size: SignedDecimal.zero(),
            margin: Decimal.zero(),
            openNotional: Decimal.zero(),
            lastUpdatedCumulativePremiumFraction: SignedDecimal.zero(),
            blockNumber: _blockNumber(),
            liquidityHistoryIndex: 0
        });
    }

    function internalLiquidate(IAmm _amm, address _trader)
        internal
        returns (Decimal.decimal memory quoteAssetAmount, bool isPartialClose)
    {
        requireAmm(_amm, true);
        SignedDecimal.signedDecimal memory marginRatio = getMarginRatio(_amm, _trader);

        // including oracle-based margin ratio as reference price when amm is over spread limit
        if (_amm.isOverSpreadLimit()) {
            SignedDecimal.signedDecimal memory marginRatioBasedOnOracle =
                _getMarginRatioByCalcOption(_amm, _trader, PnlCalcOption.ORACLE);
            if (marginRatioBasedOnOracle.subD(marginRatio).toInt() > 0) {
                marginRatio = marginRatioBasedOnOracle;
            }
        }
        requireMoreMarginRatio(marginRatio, maintenanceMarginRatio, false);

        PositionResp memory positionResp;
        Decimal.decimal memory liquidationPenalty;
        {
            Decimal.decimal memory liquidationBadDebt;
            Decimal.decimal memory feeToLiquidator;
            Decimal.decimal memory feeToInsuranceFund;
            IERC20 quoteAsset = _amm.quoteAsset();

            int256 marginRatioBasedOnSpot =
                _getMarginRatioByCalcOption(_amm, _trader, PnlCalcOption.SPOT_PRICE).toInt();
            if (
                // check margin(based on spot price) is enough to pay the liquidation fee
                // after partially close, otherwise we fully close the position.
                // that also means we can ensure no bad debt happen when partially liquidate
                marginRatioBasedOnSpot > int256(liquidationFeeRatio.toUint()) &&
                partialLiquidationRatio.cmp(Decimal.one()) < 0 &&
                partialLiquidationRatio.toUint() != 0
            ) {
                Position memory position = getPosition(_amm, _trader);
                Decimal.decimal memory partiallyLiquidatedPositionNotional =
                    _amm.getOutputPrice(
                        position.size.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM,
                        position.size.mulD(partialLiquidationRatio).abs()
                    );

                positionResp = openReversePosition(
                    _amm,
                    position.size.toInt() > 0 ? Side.SELL : Side.BUY,
                    _trader,
                    partiallyLiquidatedPositionNotional,
                    Decimal.one(),
                    Decimal.zero(),
                    true
                );

                // half of the liquidationFee goes to liquidator & another half goes to insurance fund
                liquidationPenalty = positionResp.exchangedQuoteAssetAmount.mulD(liquidationFeeRatio);
                feeToLiquidator = liquidationPenalty.divScalar(2);
                feeToInsuranceFund = liquidationPenalty.subD(feeToLiquidator);

                positionResp.position.margin = positionResp.position.margin.subD(liquidationPenalty);
                setPosition(_amm, _trader, positionResp.position);

                isPartialClose = true;
            } else {
                liquidationPenalty = getPosition(_amm, _trader).margin;
                positionResp = internalClosePosition(_amm, _trader, Decimal.zero());
                Decimal.decimal memory remainMargin = positionResp.marginToVault.abs();
                feeToLiquidator = positionResp.exchangedQuoteAssetAmount.mulD(liquidationFeeRatio).divScalar(2);

                // if the remainMargin is not enough for liquidationFee, count it as bad debt
                // else, then the rest will be transferred to insuranceFund
                Decimal.decimal memory totalBadDebt = positionResp.badDebt;
                if (feeToLiquidator.toUint() > remainMargin.toUint()) {
                    liquidationBadDebt = feeToLiquidator.subD(remainMargin);
                    totalBadDebt = totalBadDebt.addD(liquidationBadDebt);
                } else {
                    remainMargin = remainMargin.subD(feeToLiquidator);
                }

                // transfer the actual token between trader and vault
                if (totalBadDebt.toUint() > 0) {
                    require(backstopLiquidityProviderMap[_msgSender()], "not backstop LP");
                    realizeBadDebt(quoteAsset, totalBadDebt);
                }
                if (remainMargin.toUint() > 0) {
                    feeToInsuranceFund = remainMargin;
                }
            }

            if (feeToInsuranceFund.toUint() > 0) {
                transferToInsuranceFund(quoteAsset, feeToInsuranceFund);
            }
            withdraw(quoteAsset, _msgSender(), feeToLiquidator);
            enterRestrictionMode(_amm);

            emit PositionLiquidated(
                _trader,
                address(_amm),
                positionResp.exchangedQuoteAssetAmount.toUint(),
                positionResp.exchangedPositionSize.toUint(),
                feeToLiquidator.toUint(),
                _msgSender(),
                liquidationBadDebt.toUint()
            );
        }

        // emit event
        uint256 spotPrice = _amm.getSpotPrice().toUint();
        int256 fundingPayment = positionResp.fundingPayment.toInt();
        emit PositionChanged(
            _trader,
            address(_amm),
            positionResp.position.margin.toUint(),
            positionResp.exchangedQuoteAssetAmount.toUint(),
            positionResp.exchangedPositionSize.toInt(),
            0,
            positionResp.position.size.toInt(),
            positionResp.realizedPnl.toInt(),
            positionResp.unrealizedPnlAfter.toInt(),
            positionResp.badDebt.toUint(),
            liquidationPenalty.toUint(),
            spotPrice,
            fundingPayment
        );

        return (positionResp.exchangedQuoteAssetAmount, isPartialClose);
    }

    // only called from openPosition and closeAndOpenReversePosition. caller need to ensure there's enough marginRatio
    function internalIncreasePosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _openNotional,
        Decimal.decimal memory _minPositionSize,
        Decimal.decimal memory _leverage
    ) internal returns (PositionResp memory positionResp) {
        address trader = _msgSender();
        Position memory oldPosition = getPosition(_amm, trader);
        positionResp.exchangedPositionSize = swapInput(_amm, _side, _openNotional, _minPositionSize, false);
        SignedDecimal.signedDecimal memory newSize = oldPosition.size.addD(positionResp.exchangedPositionSize);

        updateOpenInterestNotional(_amm, MixedDecimal.fromDecimal(_openNotional));
        // if the trader is not in the whitelist, check max position size
        if (trader != whitelist) {
            Decimal.decimal memory maxHoldingBaseAsset = _amm.getMaxHoldingBaseAsset();
            if (maxHoldingBaseAsset.toUint() > 0) {
                // total position size should be less than `positionUpperBound`
                require(newSize.abs().cmp(maxHoldingBaseAsset) <= 0, "hit position size upper bound");
            }
        }

        SignedDecimal.signedDecimal memory increaseMarginRequirement =
            MixedDecimal.fromDecimal(_openNotional.divD(_leverage));
        (
            Decimal.decimal memory remainMargin, // the 2nd return (bad debt) must be 0 - already checked from caller
            ,
            SignedDecimal.signedDecimal memory fundingPayment,
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
        ) = calcRemainMarginWithFundingPayment(_amm, oldPosition, increaseMarginRequirement);

        (, SignedDecimal.signedDecimal memory unrealizedPnl) =
            getPositionNotionalAndUnrealizedPnl(_amm, trader, PnlCalcOption.SPOT_PRICE);

        // update positionResp
        positionResp.exchangedQuoteAssetAmount = _openNotional;
        positionResp.unrealizedPnlAfter = unrealizedPnl;
        positionResp.marginToVault = increaseMarginRequirement;
        positionResp.fundingPayment = fundingPayment;
        positionResp.position = Position(
            newSize,
            remainMargin,
            oldPosition.openNotional.addD(positionResp.exchangedQuoteAssetAmount),
            latestCumulativePremiumFraction,
            oldPosition.liquidityHistoryIndex,
            _blockNumber()
        );
    }

    function openReversePosition(
        IAmm _amm,
        Side _side,
        address _trader,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit,
        bool _canOverFluctuationLimit
    ) internal returns (PositionResp memory) {
        Decimal.decimal memory openNotional = _quoteAssetAmount.mulD(_leverage);
        (Decimal.decimal memory oldPositionNotional, SignedDecimal.signedDecimal memory unrealizedPnl) =
            getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.SPOT_PRICE);
        PositionResp memory positionResp;

        // reduce position if old position is larger
        if (oldPositionNotional.toUint() > openNotional.toUint()) {
            updateOpenInterestNotional(_amm, MixedDecimal.fromDecimal(openNotional).mulScalar(-1));
            Position memory oldPosition = getPosition(_amm, _trader);
            positionResp.exchangedPositionSize = swapInput(
                _amm,
                _side,
                openNotional,
                _baseAssetAmountLimit,
                _canOverFluctuationLimit
            );

            // realizedPnl = unrealizedPnl * closedRatio
            // closedRatio = positionResp.exchangedPositionSiz / oldPosition.size
            if (oldPosition.size.toInt() != 0) {
                positionResp.realizedPnl = unrealizedPnl.mulD(positionResp.exchangedPositionSize.abs()).divD(
                    oldPosition.size.abs()
                );
            }
            Decimal.decimal memory remainMargin;
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction;
            (
                remainMargin,
                positionResp.badDebt,
                positionResp.fundingPayment,
                latestCumulativePremiumFraction
            ) = calcRemainMarginWithFundingPayment(_amm, oldPosition, positionResp.realizedPnl);

            // positionResp.unrealizedPnlAfter = unrealizedPnl - realizedPnl
            positionResp.unrealizedPnlAfter = unrealizedPnl.subD(positionResp.realizedPnl);
            positionResp.exchangedQuoteAssetAmount = openNotional;

            // calculate openNotional (it's different depends on long or short side)
            // long: unrealizedPnl = positionNotional - openNotional => openNotional = positionNotional - unrealizedPnl
            // short: unrealizedPnl = openNotional - positionNotional => openNotional = positionNotional + unrealizedPnl
            // positionNotional = oldPositionNotional - exchangedQuoteAssetAmount
            SignedDecimal.signedDecimal memory remainOpenNotional =
                oldPosition.size.toInt() > 0
                    ? MixedDecimal.fromDecimal(oldPositionNotional).subD(positionResp.exchangedQuoteAssetAmount).subD(
                        positionResp.unrealizedPnlAfter
                    )
                    : positionResp.unrealizedPnlAfter.addD(oldPositionNotional).subD(
                        positionResp.exchangedQuoteAssetAmount
                    );
            require(remainOpenNotional.toInt() > 0, "value of openNotional <= 0");

            positionResp.position = Position(
                oldPosition.size.addD(positionResp.exchangedPositionSize),
                remainMargin,
                remainOpenNotional.abs(),
                latestCumulativePremiumFraction,
                oldPosition.liquidityHistoryIndex,
                _blockNumber()
            );
            return positionResp;
        }

        return closeAndOpenReversePosition(_amm, _side, _trader, _quoteAssetAmount, _leverage, _baseAssetAmountLimit);
    }

    function closeAndOpenReversePosition(
        IAmm _amm,
        Side _side,
        address _trader,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit
    ) internal returns (PositionResp memory positionResp) {
        // new position size is larger than or equal to the old position size
        // so either close or close then open a larger position
        PositionResp memory closePositionResp = internalClosePosition(_amm, _trader, Decimal.zero());

        // the old position is underwater. trader should close a position first
        require(closePositionResp.badDebt.toUint() == 0, "reduce an underwater position");

        // update open notional after closing position
        Decimal.decimal memory openNotional =
            _quoteAssetAmount.mulD(_leverage).subD(closePositionResp.exchangedQuoteAssetAmount);

        // if remain exchangedQuoteAssetAmount is too small (eg. 1wei) then the required margin might be 0
        // then the clearingHouse will stop opening position
        if (openNotional.divD(_leverage).toUint() == 0) {
            positionResp = closePositionResp;
        } else {
            Decimal.decimal memory updatedBaseAssetAmountLimit;
            if (_baseAssetAmountLimit.toUint() > closePositionResp.exchangedPositionSize.toUint()) {
                updatedBaseAssetAmountLimit = _baseAssetAmountLimit.subD(closePositionResp.exchangedPositionSize.abs());
            }

            PositionResp memory increasePositionResp =
                internalIncreasePosition(_amm, _side, openNotional, updatedBaseAssetAmountLimit, _leverage);
            positionResp = PositionResp({
                position: increasePositionResp.position,
                exchangedQuoteAssetAmount: closePositionResp.exchangedQuoteAssetAmount.addD(
                    increasePositionResp.exchangedQuoteAssetAmount
                ),
                badDebt: closePositionResp.badDebt.addD(increasePositionResp.badDebt),
                fundingPayment: closePositionResp.fundingPayment.addD(increasePositionResp.fundingPayment),
                exchangedPositionSize: closePositionResp.exchangedPositionSize.addD(
                    increasePositionResp.exchangedPositionSize
                ),
                realizedPnl: closePositionResp.realizedPnl.addD(increasePositionResp.realizedPnl),
                unrealizedPnlAfter: SignedDecimal.zero(),
                marginToVault: closePositionResp.marginToVault.addD(increasePositionResp.marginToVault)
            });
        }
        return positionResp;
    }

    function internalClosePosition(
        IAmm _amm,
        address _trader,
        Decimal.decimal memory _quoteAssetAmountLimit
    ) private returns (PositionResp memory positionResp) {
        // check conditions
        Position memory oldPosition = getPosition(_amm, _trader);
        requirePositionSize(oldPosition.size);

        (, SignedDecimal.signedDecimal memory unrealizedPnl) =
            getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.SPOT_PRICE);
        (
            Decimal.decimal memory remainMargin,
            Decimal.decimal memory badDebt,
            SignedDecimal.signedDecimal memory fundingPayment,

        ) = calcRemainMarginWithFundingPayment(_amm, oldPosition, unrealizedPnl);

        positionResp.exchangedPositionSize = oldPosition.size.mulScalar(-1);
        positionResp.realizedPnl = unrealizedPnl;
        positionResp.badDebt = badDebt;
        positionResp.fundingPayment = fundingPayment;
        positionResp.marginToVault = MixedDecimal.fromDecimal(remainMargin).mulScalar(-1);
        // for amm.swapOutput, the direction is in base asset, from the perspective of Amm
        positionResp.exchangedQuoteAssetAmount = _amm.swapOutput(
            oldPosition.size.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM,
            oldPosition.size.abs(),
            _quoteAssetAmountLimit
        );

        // bankrupt position's bad debt will be also consider as a part of the open interest
        updateOpenInterestNotional(_amm, unrealizedPnl.addD(badDebt).addD(oldPosition.openNotional).mulScalar(-1));
        clearPosition(_amm, _trader);
    }

    function swapInput(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _inputAmount,
        Decimal.decimal memory _minOutputAmount,
        bool _canOverFluctuationLimit
    ) internal returns (SignedDecimal.signedDecimal memory) {
        // for amm.swapInput, the direction is in quote asset, from the perspective of Amm
        IAmm.Dir dir = (_side == Side.BUY) ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM;
        SignedDecimal.signedDecimal memory outputAmount =
            MixedDecimal.fromDecimal(_amm.swapInput(dir, _inputAmount, _minOutputAmount, _canOverFluctuationLimit));
        if (IAmm.Dir.REMOVE_FROM_AMM == dir) {
            return outputAmount.mulScalar(-1);
        }
        return outputAmount;
    }

    function transferFee(
        address _from,
        IAmm _amm,
        Decimal.decimal memory _positionNotional
    ) internal returns (Decimal.decimal memory) {
        // the logic of toll fee can be removed if the bytecode size is too large
        (Decimal.decimal memory toll, Decimal.decimal memory spread) = _amm.calcFee(_positionNotional);
        bool hasToll = toll.toUint() > 0;
        bool hasSpread = spread.toUint() > 0;
        if (hasToll || hasSpread) {
            IERC20 quoteAsset = _amm.quoteAsset();

            // transfer spread to insurance fund
            if (hasSpread) {
                _transferFrom(quoteAsset, _from, address(insuranceFund), spread);
            }

            // transfer toll to feePool
            if (hasToll) {
                require(address(feePool) != address(0), "Invalid feePool");
                _transferFrom(quoteAsset, _from, address(feePool), toll);
            }

            // fee = spread + toll
            return toll.addD(spread);
        }
    }

    function withdraw(
        IERC20 _token,
        address _receiver,
        Decimal.decimal memory _amount
    ) internal {
        // if withdraw amount is larger than entire balance of vault
        // means this trader's profit comes from other under collateral position's future loss
        // and the balance of entire vault is not enough
        // need money from IInsuranceFund to pay first, and record this prepaidBadDebt
        // in this case, insurance fund loss must be zero
        Decimal.decimal memory totalTokenBalance = _balanceOf(_token, address(this));
        if (totalTokenBalance.toUint() < _amount.toUint()) {
            Decimal.decimal memory balanceShortage = _amount.subD(totalTokenBalance);
            prepaidBadDebt[address(_token)] = prepaidBadDebt[address(_token)].addD(balanceShortage);
            insuranceFund.withdraw(_token, balanceShortage);
        }

        _transfer(_token, _receiver, _amount);
    }

    function realizeBadDebt(IERC20 _token, Decimal.decimal memory _badDebt) internal {
        Decimal.decimal memory badDebtBalance = prepaidBadDebt[address(_token)];
        if (badDebtBalance.toUint() > _badDebt.toUint()) {
            // no need to move extra tokens because vault already prepay bad debt, only need to update the numbers
            prepaidBadDebt[address(_token)] = badDebtBalance.subD(_badDebt);
        } else {
            // in order to realize all the bad debt vault need extra tokens from insuranceFund
            insuranceFund.withdraw(_token, _badDebt.subD(badDebtBalance));
            prepaidBadDebt[address(_token)] = Decimal.zero();
        }
    }

    function transferToInsuranceFund(IERC20 _token, Decimal.decimal memory _amount) internal {
        Decimal.decimal memory totalTokenBalance = _balanceOf(_token, address(this));
        _transfer(
            _token,
            address(insuranceFund),
            totalTokenBalance.toUint() < _amount.toUint() ? totalTokenBalance : _amount
        );
    }

    /**
     * @dev assume this will be removes soon once the guarded period has ended. caller need to ensure amm exist
     */
    function updateOpenInterestNotional(IAmm _amm, SignedDecimal.signedDecimal memory _amount) internal {
        // when cap = 0 means no cap
        uint256 cap = _amm.getOpenInterestNotionalCap().toUint();
        address ammAddr = address(_amm);
        if (cap > 0) {
            SignedDecimal.signedDecimal memory updatedOpenInterestNotional =
                _amount.addD(openInterestNotionalMap[ammAddr]);
            // the reduced open interest can be larger than total when profit is too high and other position are bankrupt
            if (updatedOpenInterestNotional.toInt() < 0) {
                updatedOpenInterestNotional = SignedDecimal.zero();
            }
            if (_amount.toInt() > 0) {
                // whitelist won't be restrict by open interest cap
                require(updatedOpenInterestNotional.toUint() <= cap || _msgSender() == whitelist, "over limit");
            }
            openInterestNotionalMap[ammAddr] = updatedOpenInterestNotional.abs();
        }
    }

    //
    // INTERNAL VIEW FUNCTIONS
    //

    function calcRemainMarginWithFundingPayment(
        IAmm _amm,
        Position memory _oldPosition,
        SignedDecimal.signedDecimal memory _marginDelta
    )
        private
        view
        returns (
            Decimal.decimal memory remainMargin,
            Decimal.decimal memory badDebt,
            SignedDecimal.signedDecimal memory fundingPayment,
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
        )
    {
        // calculate funding payment
        latestCumulativePremiumFraction = getLatestCumulativePremiumFraction(_amm);
        if (_oldPosition.size.toInt() != 0) {
            fundingPayment = latestCumulativePremiumFraction
                .subD(_oldPosition.lastUpdatedCumulativePremiumFraction)
                .mulD(_oldPosition.size);
        }

        // calculate remain margin
        SignedDecimal.signedDecimal memory signedRemainMargin =
            _marginDelta.subD(fundingPayment).addD(_oldPosition.margin);

        // if remain margin is negative, set to zero and leave the rest to bad debt
        if (signedRemainMargin.toInt() < 0) {
            badDebt = signedRemainMargin.abs();
        } else {
            remainMargin = signedRemainMargin.abs();
        }
    }

    /// @param _marginWithFundingPayment margin + funding payment - bad debt
    function calcFreeCollateral(
        IAmm _amm,
        address _trader,
        Decimal.decimal memory _marginWithFundingPayment
    ) internal view returns (SignedDecimal.signedDecimal memory) {
        Position memory pos = getPosition(_amm, _trader);
        (SignedDecimal.signedDecimal memory unrealizedPnl, Decimal.decimal memory positionNotional) =
            getPreferencePositionNotionalAndUnrealizedPnl(_amm, _trader, PnlPreferenceOption.MIN_PNL);

        // min(margin + funding, margin + funding + unrealized PnL) - position value * initMarginRatio
        SignedDecimal.signedDecimal memory accountValue = unrealizedPnl.addD(_marginWithFundingPayment);
        SignedDecimal.signedDecimal memory minCollateral =
            unrealizedPnl.toInt() > 0 ? MixedDecimal.fromDecimal(_marginWithFundingPayment) : accountValue;

        // margin requirement
        // if holding a long position, using open notional (mapping to quote debt in Curie)
        // if holding a short position, using position notional (mapping to base debt in Curie)
        SignedDecimal.signedDecimal memory marginRequirement =
            pos.size.toInt() > 0
                ? MixedDecimal.fromDecimal(pos.openNotional).mulD(initMarginRatio)
                : MixedDecimal.fromDecimal(positionNotional).mulD(initMarginRatio);

        return minCollateral.subD(marginRequirement);
    }

    function getPreferencePositionNotionalAndUnrealizedPnl(
        IAmm _amm,
        address _trader,
        PnlPreferenceOption _pnlPreference
    )
        internal
        view
        returns (SignedDecimal.signedDecimal memory unrealizedPnl, Decimal.decimal memory positionNotional)
    {
        (Decimal.decimal memory spotPositionNotional, SignedDecimal.signedDecimal memory spotPricePnl) =
            (getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.SPOT_PRICE));
        (Decimal.decimal memory twapPositionNotional, SignedDecimal.signedDecimal memory twapPricePnl) =
            (getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.TWAP));

        // if MAX_PNL
        //    spotPnL >  twapPnL return (spotPnL, spotPositionNotional)
        //    spotPnL <= twapPnL return (twapPnL, twapPositionNotional)
        // if MIN_PNL
        //    spotPnL >  twapPnL return (twapPnL, twapPositionNotional)
        //    spotPnL <= twapPnL return (spotPnL, spotPositionNotional)
        (unrealizedPnl, positionNotional) = (_pnlPreference == PnlPreferenceOption.MAX_PNL) ==
            (spotPricePnl.toInt() > twapPricePnl.toInt())
            ? (spotPricePnl, spotPositionNotional)
            : (twapPricePnl, twapPositionNotional);
    }

    function getUnadjustedPosition(IAmm _amm, address _trader) public view returns (Position memory position) {
        position = ammMap[address(_amm)].positionMap[_trader];
    }

    function _msgSender() internal view override(BaseRelayRecipient, ContextUpgradeSafe) returns (address payable) {
        return super._msgSender();
    }

    function _msgData() internal view override(BaseRelayRecipient, ContextUpgradeSafe) returns (bytes memory ret) {
        return super._msgData();
    }

    //
    // REQUIRE FUNCTIONS
    //
    function requireAmm(IAmm _amm, bool _open) private view {
        require(insuranceFund.isExistedAmm(_amm), "amm not found");
        require(_open == _amm.open(), _open ? "amm was closed" : "amm is open");
    }

    function requireNonZeroInput(Decimal.decimal memory _decimal) private pure {
        require(_decimal.toUint() != 0, "input is 0");
    }

    function requirePositionSize(SignedDecimal.signedDecimal memory _size) private pure {
        require(_size.toInt() != 0, "positionSize is 0");
    }

    function requireValidTokenAmount(IERC20 _token, Decimal.decimal memory _decimal) private view {
        require(_toUint(_token, _decimal) != 0, "invalid token amount");
    }

    function requireNotRestrictionMode(IAmm _amm) private view {
        uint256 currentBlock = _blockNumber();
        if (currentBlock == ammMap[address(_amm)].lastRestrictionBlock) {
            require(getPosition(_amm, _msgSender()).blockNumber != currentBlock, "only one action allowed");
        }
    }

    function requireMoreMarginRatio(
        SignedDecimal.signedDecimal memory _marginRatio,
        Decimal.decimal memory _baseMarginRatio,
        bool _largerThanOrEqualTo
    ) private pure {
        int256 remainingMarginRatio = _marginRatio.subD(_baseMarginRatio).toInt();
        require(
            _largerThanOrEqualTo ? remainingMarginRatio >= 0 : remainingMarginRatio < 0,
            "Margin ratio not meet criteria"
        );
    }
}
