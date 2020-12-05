// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { BlockContext } from "./utils/BlockContext.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IMultiTokenRewardRecipient } from "./interface/IMultiTokenRewardRecipient.sol";
import { Decimal } from "./utils/Decimal.sol";
import { SignedDecimal } from "./utils/SignedDecimal.sol";
import { MixedDecimal } from "./utils/MixedDecimal.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { IAmm } from "./interface/IAmm.sol";
import { IInsuranceFund } from "./interface/IInsuranceFund.sol";
import { BaseRelayRecipient } from "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import { ContextUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import { OwnerPausableUpgradeSafe } from "./OwnerPausable.sol";
// prettier-ignore
// solhint-disable-next-line
import { ReentrancyGuardUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";

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
    event MarginChanged(address sender, address amm, int256 amount);
    event PositionAdjusted(
        address amm,
        address trader,
        int256 newPositionSize,
        uint256 oldLiquidityIndex,
        uint256 newLiquidityIndex
    );
    event PositionSettled(address amm, address trader, uint256 valueTransferred);
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
    /// @param quoteAssetReserve quote asset reserve after this event, e.g. USDC
    /// @param baseAssetReserve base asset reserve after this event, e.g. ETHUSDC, LINKUSDC
    event PositionChanged(
        address trader,
        address amm,
        uint256 margin,
        uint256 positionNotional,
        int256 exchangedPositionSize,
        uint256 fee,
        int256 positionSizeAfter,
        int256 realizedPnl,
        int256 unrealizedPnlAfter,
        uint256 badDebt,
        uint256 liquidationPenalty,
        uint256 quoteAssetReserve,
        uint256 baseAssetReserve
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
        address trader,
        address amm,
        uint256 positionNotional,
        uint256 positionSize,
        uint256 liquidationFee,
        address liquidator,
        uint256 badDebt
    );

    //
    // Struct and Enum
    //

    enum Side { BUY, SELL }
    enum PnlCalcOption { SPOT_PRICE, TWAP }

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

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

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
        __ReentrancyGuard_init();

        versionRecipient = "1.0.0"; // we are not using it atm
        initMarginRatio = Decimal.decimal(_initMarginRatio);
        setMaintenanceMarginRatio(Decimal.decimal(_maintenanceMarginRatio));
        setLiquidationFeeRatio(Decimal.decimal(_liquidationFeeRatio));
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
    function setLiquidationFeeRatio(Decimal.decimal memory _liquidationFeeRatio) public onlyOwner {
        liquidationFeeRatio = _liquidationFeeRatio;
        emit LiquidationFeeRatioChanged(liquidationFeeRatio.toUint());
    }

    /**
     * @notice set maintenance margin ratio
     * @dev only owner can call
     * @param _maintenanceMarginRatio new maintenance margin ratio in 18 digits
     */
    function setMaintenanceMarginRatio(Decimal.decimal memory _maintenanceMarginRatio) public onlyOwner {
        maintenanceMarginRatio = _maintenanceMarginRatio;
        emit MarginRatioChanged(maintenanceMarginRatio.toUint());
    }

    function setFeePool(IMultiTokenRewardRecipient _feePool) external onlyOwner {
        feePool = _feePool;
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
     * @notice add margin to increase margin ratio
     * @param _amm IAmm address
     * @param _addedMargin added margin in 18 digits
     */
    function addMargin(IAmm _amm, Decimal.decimal calldata _addedMargin) external whenNotPaused() nonReentrant() {
        // check condition
        requireAmm(_amm, true);
        requireNonZeroInput(_addedMargin);

        // update margin part in personal position
        updateMargin(_amm, MixedDecimal.fromDecimal(_addedMargin));

        // transfer token from trader
        _transferFrom(_amm.quoteAsset(), _msgSender(), address(this), _addedMargin);
    }

    /**
     * @notice remove margin to decrease margin ratio
     * @param _amm IAmm address
     * @param _removedMargin removed margin in 18 digits
     */
    function removeMargin(IAmm _amm, Decimal.decimal calldata _removedMargin) external whenNotPaused() nonReentrant() {
        // check condition
        requireAmm(_amm, true);
        requireNonZeroInput(_removedMargin);

        // update margin part in personal position, and get new margin
        updateMargin(_amm, MixedDecimal.fromDecimal(_removedMargin).mulScalar(-1));

        // check margin ratio
        requireMoreMarginRatio(getMarginRatio(_amm, _msgSender()), initMarginRatio, true);

        // transfer token back to trader
        withdraw(_amm.quoteAsset(), _msgSender(), _removedMargin);
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
            SignedDecimal.signedDecimal memory returnedFund = pos
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
        Decimal.decimal calldata _quoteAssetAmount,
        Decimal.decimal calldata _leverage,
        Decimal.decimal calldata _baseAssetAmountLimit
    ) external whenNotPaused() nonReentrant() {
        requireAmm(_amm, true);
        requireNonZeroInput(_quoteAssetAmount);
        requireNonZeroInput(_leverage);
        requireMoreMarginRatio(MixedDecimal.fromDecimal(Decimal.one()).divD(_leverage), initMarginRatio, true);
        requireNotRestrictionMode(_amm);

        address trader = _msgSender();
        PositionResp memory positionResp;
        {
            // add scope for stack too deep error
            int256 oldPositionSize = adjustPositionForLiquidityChanged(_amm, trader).size.toInt();
            if (oldPositionSize > 0) {
                requireMoreMarginRatio(getMarginRatio(_amm, trader), maintenanceMarginRatio, true);
            }

            // increase or decrease position depends on old position's side and size
            if (oldPositionSize == 0 || (oldPositionSize > 0 ? Side.BUY : Side.SELL) == _side) {
                positionResp = internalIncreasePosition(
                    _amm,
                    _side,
                    _quoteAssetAmount.mulD(_leverage),
                    _baseAssetAmountLimit,
                    _leverage
                );
            } else {
                positionResp = openReversePosition(_amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit);
            }

            // update the position state
            setPosition(_amm, trader, positionResp.position);

            // to prevent attacker to leverage the bad debt to withdraw extra token from  insurance fund
            if (positionResp.badDebt.toUint() > 0) {
                enterRestrictionMode(_amm);
            }

            // transfer the actual token between trader and vault
            IERC20 quoteToken = _amm.quoteAsset();
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
        (Decimal.decimal memory quoteAssetReserve, Decimal.decimal memory baseAssetReserve) = _amm.getReserve();
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
            quoteAssetReserve.toUint(),
            baseAssetReserve.toUint()
        );
    }

    /**
     * @notice close all the positions
     * @param _amm IAmm address
     */
    function closePosition(IAmm _amm, Decimal.decimal calldata _quoteAssetAmountLimit)
        external
        whenNotPaused()
        nonReentrant()
    {
        // check conditions
        requireAmm(_amm, true);
        requireNotRestrictionMode(_amm);

        // update position
        address trader = _msgSender();
        adjustPositionForLiquidityChanged(_amm, trader);
        PositionResp memory positionResp = internalClosePosition(_amm, trader, _quoteAssetAmountLimit, true);

        {
            // add scope for stack too deep error
            // transfer the actual token from trader and vault
            IERC20 quoteToken = _amm.quoteAsset();
            if (positionResp.badDebt.toUint() > 0) {
                enterRestrictionMode(_amm);
                realizeBadDebt(quoteToken, positionResp.badDebt);
            }
            withdraw(quoteToken, trader, positionResp.marginToVault.abs());
        }

        // calculate fee and transfer token for fees
        Decimal.decimal memory transferredFee = transferFee(trader, _amm, positionResp.exchangedQuoteAssetAmount);

        // prepare event
        (Decimal.decimal memory quoteAssetReserve, Decimal.decimal memory baseAssetReserve) = _amm.getReserve();
        emit PositionChanged(
            trader,
            address(_amm),
            0, // margin
            positionResp.exchangedQuoteAssetAmount.toUint(),
            positionResp.exchangedPositionSize.toInt(),
            transferredFee.toUint(),
            positionResp.position.size.toInt(),
            positionResp.realizedPnl.toInt(),
            0, // unrealizedPnl
            positionResp.badDebt.toUint(),
            0,
            quoteAssetReserve.toUint(),
            baseAssetReserve.toUint()
        );
    }

    /**
     * @notice liquidate trader's underwater position. Require trader's margin ratio less than maintenance margin ratio
     * @dev liquidator can NOT open any positions in the same block to prevent from price manipulation.
     * @param _amm IAmm address
     * @param _trader trader address
     */
    function liquidate(IAmm _amm, address _trader) external nonReentrant() {
        // check conditions
        requireAmm(_amm, true);
        requireMoreMarginRatio(getMarginRatio(_amm, _trader), maintenanceMarginRatio, false);

        // update states
        adjustPositionForLiquidityChanged(_amm, _trader);
        PositionResp memory positionResp = internalClosePosition(_amm, _trader, Decimal.zero(), false);

        enterRestrictionMode(_amm);

        // Amount pay to liquidator
        Decimal.decimal memory liquidationFee = positionResp.exchangedQuoteAssetAmount.mulD(liquidationFeeRatio);
        // neither trader nor liquidator should pay anything for liquidating position
        // in here, -marginToVault means remainMargin
        Decimal.decimal memory remainMargin = positionResp.marginToVault.abs();
        {
            // add scope for stack too deep error
            // if the remainMargin is not enough for liquidationFee, count it as bad debt
            // else, then the rest will be transferred to insuranceFund
            Decimal.decimal memory liquidationBadDebt;
            Decimal.decimal memory totalBadDebt = positionResp.badDebt;
            SignedDecimal.signedDecimal memory totalMarginToVault = positionResp.marginToVault;
            if (liquidationFee.toUint() > remainMargin.toUint()) {
                liquidationBadDebt = liquidationFee.subD(remainMargin);
                totalBadDebt = totalBadDebt.addD(liquidationBadDebt);
            } else {
                totalMarginToVault = totalMarginToVault.addD(liquidationFee);
            }

            // transfer the actual token between trader and vault
            IERC20 quoteAsset = _amm.quoteAsset();
            if (totalBadDebt.toUint() > 0) {
                realizeBadDebt(quoteAsset, totalBadDebt);
            }
            if (totalMarginToVault.toInt() < 0) {
                transferToInsuranceFund(quoteAsset, totalMarginToVault.abs());
            }
            withdraw(quoteAsset, _msgSender(), liquidationFee);

            emit PositionLiquidated(
                _trader,
                address(_amm),
                positionResp.exchangedQuoteAssetAmount.toUint(),
                positionResp.exchangedPositionSize.toUint(),
                liquidationFee.toUint(),
                _msgSender(),
                liquidationBadDebt.toUint()
            );
        }

        // emit event
        (Decimal.decimal memory quoteAssetReserve, Decimal.decimal memory baseAssetReserve) = _amm.getReserve();
        emit PositionChanged(
            _trader,
            address(_amm),
            0,
            positionResp.exchangedQuoteAssetAmount.toUint(),
            positionResp.exchangedPositionSize.toInt(),
            0,
            0,
            positionResp.realizedPnl.toInt(),
            0,
            positionResp.badDebt.toUint(),
            remainMargin.toUint(),
            quoteAssetReserve.toUint(),
            baseAssetReserve.toUint()
        );
    }

    /**
     * @notice if funding rate is positive, traders with long position pay traders with short position and vice versa.
     * @param _amm IAmm address
     */
    function payFunding(IAmm _amm) external {
        requireAmm(_amm, true);

        // must copy the baseAssetDeltaThisFundingPeriod first
        SignedDecimal.signedDecimal memory baseAssetDeltaThisFundingPeriod = _amm.getBaseAssetDeltaThisFundingPeriod();

        SignedDecimal.signedDecimal memory premiumFraction = _amm.settleFunding();
        ammMap[address(_amm)].cumulativePremiumFractions.push(
            premiumFraction.addD(getLatestCumulativePremiumFraction(_amm))
        );

        // funding payment = premium fraction * position
        // eg. if alice takes 10 long position, baseAssetDeltaThisFundingPeriod = -10
        // if premiumFraction is positive: long pay short, amm get positive funding payment
        // if premiumFraction is negative: short pay long, amm get negative funding payment
        // if position side * premiumFraction > 0, funding payment is negative which means loss
        SignedDecimal.signedDecimal memory ammFundingPaymentLoss = premiumFraction.mulD(
            baseAssetDeltaThisFundingPeriod
        );

        IERC20 quoteAsset = _amm.quoteAsset();
        if (ammFundingPaymentLoss.toInt() > 0) {
            insuranceFund.withdraw(quoteAsset, ammFundingPaymentLoss.abs());
        } else {
            transferToInsuranceFund(quoteAsset, ammFundingPaymentLoss.abs());
        }
    }

    function adjustPositionForLiquidityChanged(IAmm _amm, address _trader) public returns (Position memory) {
        Position memory unadjustedPosition = getUnadjustedPosition(_amm, _trader);
        if (unadjustedPosition.size.toInt() == 0) {
            return unadjustedPosition;
        }
        uint256 latestLiquidityIndex = _amm.getLiquidityHistoryLength().sub(1);
        if (unadjustedPosition.liquidityHistoryIndex == latestLiquidityIndex) {
            return unadjustedPosition;
        }

        Position memory adjustedPosition = calcPositionAfterLiquidityMigration(
            _amm,
            unadjustedPosition,
            latestLiquidityIndex
        );
        setPosition(_amm, _trader, adjustedPosition);
        emit PositionAdjusted(
            address(_amm),
            _trader,
            adjustedPosition.size.toInt(),
            unadjustedPosition.liquidityHistoryIndex,
            adjustedPosition.liquidityHistoryIndex
        );
        return adjustedPosition;
    }

    //
    // VIEW FUNCTIONS
    //

    /**
     * @notice get margin ratio, marginRatio = (unrealized Pnl + margin) / openNotional
     * use spot and twap price to calculate unrealized Pnl, final unrealized Pnl depends on which one is higher
     * @param _amm IAmm address
     * @param _trader trader address
     * @return margin ratio in 18 digits
     */
    function getMarginRatio(IAmm _amm, address _trader) public view returns (SignedDecimal.signedDecimal memory) {
        Position memory position = getPosition(_amm, _trader);
        requirePositionSize(position.size);
        requireNonZeroInput(position.openNotional);

        (, SignedDecimal.signedDecimal memory spotPricePnl) = (
            getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.SPOT_PRICE)
        );
        (, SignedDecimal.signedDecimal memory twapPricePnl) = (
            getPositionNotionalAndUnrealizedPnl(_amm, _trader, PnlCalcOption.TWAP)
        );
        SignedDecimal.signedDecimal memory unrealizedPnl = spotPricePnl.toInt() > twapPricePnl.toInt()
            ? spotPricePnl
            : twapPricePnl;
        return unrealizedPnl.addD(position.margin).divD(position.openNotional);
    }

    /**
     * @notice get personal position information, and adjust size if migration is necessary
     * @param _amm IAmm address
     * @param _trader trader address
     * @return struct Position
     */
    function getPosition(IAmm _amm, address _trader) public view returns (Position memory) {
        Position memory pos = getUnadjustedPosition(_amm, _trader);
        uint256 latestLiquidityIndex = _amm.getLiquidityHistoryLength().sub(1);
        if (pos.liquidityHistoryIndex == latestLiquidityIndex) {
            return pos;
        }

        return calcPositionAfterLiquidityMigration(_amm, pos, latestLiquidityIndex);
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
        if (position.size.toInt() == 0) {
            return (Decimal.zero(), SignedDecimal.zero());
        }
        bool isShortPosition = position.size.toInt() < 0;
        IAmm.Dir dir = isShortPosition ? IAmm.Dir.REMOVE_FROM_AMM : IAmm.Dir.ADD_TO_AMM;
        if (_pnlCalcOption == PnlCalcOption.TWAP) {
            positionNotional = _amm.getOutputTwap(dir, position.size.abs());
        } else {
            positionNotional = _amm.getOutputPrice(dir, position.size.abs());
        }
        // unrealizedPnlForLongPosition = positionNotional - openNotional
        // unrealizedPnlForShortPosition = positionNotionalWhenBorrowed - positionNotionalWhenReturned =
        // openNotional - positionNotional = unrealizedPnlForLongPosition * -1
        unrealizedPnl = isShortPosition
            ? MixedDecimal.fromDecimal(position.openNotional).subD(positionNotional)
            : MixedDecimal.fromDecimal(positionNotional).subD(position.openNotional);
    }

    /**
     * @notice get latest cumulative premium fraction.
     * @param _amm IAmm address
     * @return latest cumulative premium fraction in 18 digits
     */
    function getLatestCumulativePremiumFraction(IAmm _amm) public view returns (SignedDecimal.signedDecimal memory) {
        uint256 len = ammMap[address(_amm)].cumulativePremiumFractions.length;
        if (len == 0) {
            return SignedDecimal.zero();
        }
        return ammMap[address(_amm)].cumulativePremiumFractions[len - 1];
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

    // amm, side, openNotional, minPositionSize, leverage
    function internalIncreasePosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _openNotional,
        Decimal.decimal memory _minPositionSize,
        Decimal.decimal memory _leverage
    ) internal returns (PositionResp memory positionResp) {
        address trader = _msgSender();
        Position memory oldPosition = getUnadjustedPosition(_amm, trader);
        positionResp.exchangedPositionSize = swapInput(_amm, _side, _openNotional, _minPositionSize);
        SignedDecimal.signedDecimal memory newSize = oldPosition.size.addD(positionResp.exchangedPositionSize);
        // if size is 0 (means a new position), set the latest liquidity index
        uint256 liquidityHistoryIndex = oldPosition.liquidityHistoryIndex;
        if (oldPosition.size.toInt() == 0) {
            liquidityHistoryIndex = _amm.getLiquidityHistoryLength().sub(1);
        }

        updateOpenInterestNotional(_amm, MixedDecimal.fromDecimal(_openNotional));
        // if the trader is not in the whitelist, check max position size
        if (trader != whitelist) {
            Decimal.decimal memory maxHoldingBaseAsset = _amm.getMaxHoldingBaseAsset();
            if (maxHoldingBaseAsset.toUint() > 0) {
                // total position size should be less than `positionUpperBound`
                require(newSize.abs().cmp(maxHoldingBaseAsset) <= 0, "hit position size upper bound");
            }
        }

        SignedDecimal.signedDecimal memory increaseMarginRequirement = MixedDecimal.fromDecimal(
            _openNotional.divD(_leverage)
        );
        (
            Decimal.decimal memory remainMargin,
            Decimal.decimal memory badDebt,
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
        ) = calcRemainMarginWithFundingPayment(_amm, oldPosition, increaseMarginRequirement);

        (, SignedDecimal.signedDecimal memory unrealizedPnl) = getPositionNotionalAndUnrealizedPnl(
            _amm,
            trader,
            PnlCalcOption.SPOT_PRICE
        );

        // update positionResp
        positionResp.badDebt = badDebt;
        positionResp.exchangedQuoteAssetAmount = _openNotional;
        positionResp.realizedPnl = SignedDecimal.zero();
        positionResp.unrealizedPnlAfter = unrealizedPnl;
        positionResp.marginToVault = increaseMarginRequirement;
        positionResp.position = Position(
            newSize,
            remainMargin,
            oldPosition.openNotional.addD(positionResp.exchangedQuoteAssetAmount),
            latestCumulativePremiumFraction,
            liquidityHistoryIndex,
            _blockNumber()
        );
    }

    function openReversePosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit
    ) internal returns (PositionResp memory) {
        Decimal.decimal memory openNotional = _quoteAssetAmount.mulD(_leverage);
        (
            Decimal.decimal memory oldPositionNotional,
            SignedDecimal.signedDecimal memory unrealizedPnl
        ) = getPositionNotionalAndUnrealizedPnl(_amm, _msgSender(), PnlCalcOption.SPOT_PRICE);
        PositionResp memory positionResp;

        // reduce position if old position is larger
        if (oldPositionNotional.toUint() > openNotional.toUint()) {
            updateOpenInterestNotional(_amm, MixedDecimal.fromDecimal(openNotional).mulScalar(-1));
            Position memory oldPosition = getUnadjustedPosition(_amm, _msgSender());
            positionResp.exchangedPositionSize = swapInput(_amm, _side, openNotional, _baseAssetAmountLimit);

            // realizedPnl = unrealizedPnl * closedRatio
            // closedRatio = positionResp.exchangedPositionSiz / oldPosition.size
            positionResp.realizedPnl = (oldPosition.size.toInt() == 0)
                ? SignedDecimal.zero()
                : unrealizedPnl.mulD(positionResp.exchangedPositionSize.abs()).divD(oldPosition.size.abs());
            (
                Decimal.decimal memory remainMargin,
                Decimal.decimal memory badDebt,
                SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
            ) = calcRemainMarginWithFundingPayment(_amm, oldPosition, positionResp.realizedPnl);

            positionResp.badDebt = badDebt;
            positionResp.marginToVault = SignedDecimal.zero();
            positionResp.exchangedQuoteAssetAmount = openNotional;

            // positionResp.unrealizedPnlAfter = unrealizedPnl - realizedPnl
            positionResp.unrealizedPnlAfter = unrealizedPnl.subD(positionResp.realizedPnl);

            // calculate openNotional (it's different depends on long or short side)
            // long: unrealizedPnl = positionNotional - openNotional => openNotional = positionNotional - unrealizedPnl
            // short: unrealizedPnl = openNotional - positionNotional => openNotional = positionNotional + unrealizedPnl
            // positionNotional = oldPositionNotional - exchangedQuoteAssetAmount
            SignedDecimal.signedDecimal memory remainOpenNotional = oldPosition.size.toInt() > 0
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

        return closeAndOpenReversePosition(_amm, _side, _quoteAssetAmount, _leverage, _baseAssetAmountLimit);
    }

    function closeAndOpenReversePosition(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _quoteAssetAmount,
        Decimal.decimal memory _leverage,
        Decimal.decimal memory _baseAssetAmountLimit
    ) internal returns (PositionResp memory positionResp) {
        // new position size is larger than or equal to the old position size
        // so either close or close then open a larger position
        PositionResp memory closePositionResp = internalClosePosition(_amm, _msgSender(), Decimal.zero(), true);

        // the old position is underwater. trader should close a position first
        require(closePositionResp.badDebt.toUint() == 0, "reduce an underwater position");

        // update open notional after closing position
        Decimal.decimal memory openNotional = _quoteAssetAmount.mulD(_leverage).subD(
            closePositionResp.exchangedQuoteAssetAmount
        );

        // if remain exchangedQuoteAssetAmount is too small (eg. 1wei) then the required margin might be 0
        // then the clearingHouse will stop opening position
        if (openNotional.divD(_leverage).toUint() == 0) {
            positionResp = closePositionResp;
        } else {
            Decimal.decimal memory updatedBaseAssetAmountLimit = _baseAssetAmountLimit.toUint() >
                closePositionResp.exchangedPositionSize.toUint()
                ? _baseAssetAmountLimit.subD(closePositionResp.exchangedPositionSize.abs())
                : Decimal.zero();
            PositionResp memory increasePositionResp = internalIncreasePosition(
                _amm,
                _side,
                openNotional,
                updatedBaseAssetAmountLimit,
                _leverage
            );
            positionResp = PositionResp({
                position: increasePositionResp.position,
                exchangedQuoteAssetAmount: closePositionResp.exchangedQuoteAssetAmount.addD(
                    increasePositionResp.exchangedQuoteAssetAmount
                ),
                badDebt: closePositionResp.badDebt.addD(increasePositionResp.badDebt),
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
        Decimal.decimal memory _quoteAssetAmountLimit,
        bool _skipFluctuationCheck
    ) private returns (PositionResp memory positionResp) {
        // check conditions
        Position memory oldPosition = getUnadjustedPosition(_amm, _trader);
        SignedDecimal.signedDecimal memory oldPositionSize = oldPosition.size;
        requirePositionSize(oldPositionSize);

        (, SignedDecimal.signedDecimal memory unrealizedPnl) = getPositionNotionalAndUnrealizedPnl(
            _amm,
            _trader,
            PnlCalcOption.SPOT_PRICE
        );
        (Decimal.decimal memory remainMargin, Decimal.decimal memory badDebt, ) = calcRemainMarginWithFundingPayment(
            _amm,
            oldPosition,
            unrealizedPnl
        );

        positionResp.exchangedPositionSize = oldPositionSize.mulScalar(-1);
        positionResp.realizedPnl = unrealizedPnl;
        positionResp.unrealizedPnlAfter = SignedDecimal.zero();
        positionResp.badDebt = badDebt;
        positionResp.marginToVault = MixedDecimal.fromDecimal(remainMargin).mulScalar(-1);
        positionResp.exchangedQuoteAssetAmount = _amm.swapOutput(
            oldPositionSize.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM,
            oldPositionSize.abs(),
            _quoteAssetAmountLimit,
            _skipFluctuationCheck
        );

        // bankrupt position's bad debt will be also consider as a part of the open interest
        updateOpenInterestNotional(_amm, unrealizedPnl.addD(badDebt).addD(oldPosition.openNotional).mulScalar(-1));
        clearPosition(_amm, _trader);
    }

    function swapInput(
        IAmm _amm,
        Side _side,
        Decimal.decimal memory _inputAmount,
        Decimal.decimal memory _minOutputAmount
    ) internal returns (SignedDecimal.signedDecimal memory) {
        IAmm.Dir dir = (_side == Side.BUY) ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM;
        SignedDecimal.signedDecimal memory outputAmount = MixedDecimal.fromDecimal(
            _amm.swapInput(dir, _inputAmount, _minOutputAmount)
        );
        if (IAmm.Dir.REMOVE_FROM_AMM == dir) {
            return outputAmount.mulScalar(-1);
        }
        return outputAmount;
    }

    // ensure the caller already check the inputs
    function updateMargin(IAmm _amm, SignedDecimal.signedDecimal memory _margin) private {
        // update margin part in personal position and get new margin, but without realizing the funding payment
        address trader = _msgSender();
        Position memory position = adjustPositionForLiquidityChanged(_amm, trader);
        SignedDecimal.signedDecimal memory sumMargin = _margin.addD(position.margin);
        require(sumMargin.toInt() > 0, "margin is not enough");
        position.margin = sumMargin.abs();
        setPosition(_amm, trader, position);
        emit MarginChanged(trader, address(_amm), _margin.toInt());
    }

    function transferFee(
        address _from,
        IAmm _amm,
        Decimal.decimal memory _positionNotional
    ) internal returns (Decimal.decimal memory) {
        (Decimal.decimal memory toll, Decimal.decimal memory spread) = _amm.calcFee(_positionNotional);
        bool hasToll = toll.toUint() > 0;
        bool hasSpread = spread.toUint() > 0;
        if (!hasToll && !hasSpread) {
            return Decimal.zero();
        }

        IERC20 quoteAsset = _amm.quoteAsset();

        // transfer spread to insurance fund
        if (hasSpread) {
            _transferFrom(quoteAsset, _from, address(insuranceFund), spread);
        }

        // transfer toll to feePool, it's `stakingReserve` for now.
        if (hasToll) {
            require(address(feePool) != address(0), "Invalid FeePool");
            _transferFrom(quoteAsset, _from, address(feePool), toll);
            feePool.notifyTokenAmount(quoteAsset, toll);
        }

        // fee = spread + toll
        return toll.addD(spread);
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
            SignedDecimal.signedDecimal memory updatedOpenInterestNotional = _amount.addD(
                openInterestNotionalMap[ammAddr]
            );
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

    function calcPositionAfterLiquidityMigration(
        IAmm _amm,
        Position memory _position,
        uint256 _latestLiquidityIndex
    ) internal view returns (Position memory) {
        if (_position.size.toInt() == 0) {
            _position.liquidityHistoryIndex = _latestLiquidityIndex;
            return _position;
        }

        // get the change in Amm notional value
        // notionalDelta = current cumulative notional - cumulative notional of last snapshot
        IAmm.LiquidityChangedSnapshot memory lastSnapshot = _amm.getLiquidityChangedSnapshots(
            _position.liquidityHistoryIndex
        );
        SignedDecimal.signedDecimal memory notionalDelta = _amm.getCumulativeNotional().subD(
            lastSnapshot.cumulativeNotional
        );

        // update the old curve's reserve
        // by applying notionalDelta to the old curve
        Decimal.decimal memory updatedOldBaseReserve;
        Decimal.decimal memory updatedOldQuoteReserve;
        if (notionalDelta.toInt() != 0) {
            Decimal.decimal memory baseAssetWorth = _amm.getInputPriceWithReserves(
                notionalDelta.toInt() > 0 ? IAmm.Dir.ADD_TO_AMM : IAmm.Dir.REMOVE_FROM_AMM,
                notionalDelta.abs(),
                lastSnapshot.quoteAssetReserve,
                lastSnapshot.baseAssetReserve
            );
            updatedOldQuoteReserve = notionalDelta.addD(lastSnapshot.quoteAssetReserve).abs();
            if (notionalDelta.toInt() > 0) {
                updatedOldBaseReserve = lastSnapshot.baseAssetReserve.subD(baseAssetWorth);
            } else {
                updatedOldBaseReserve = lastSnapshot.baseAssetReserve.addD(baseAssetWorth);
            }
        } else {
            updatedOldQuoteReserve = lastSnapshot.quoteAssetReserve;
            updatedOldBaseReserve = lastSnapshot.baseAssetReserve;
        }

        // calculate the new position size
        _position.size = _amm.calcBaseAssetAfterLiquidityMigration(
            _position.size,
            updatedOldQuoteReserve,
            updatedOldBaseReserve
        );
        _position.liquidityHistoryIndex = _latestLiquidityIndex;

        return _position;
    }

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
            SignedDecimal.signedDecimal memory latestCumulativePremiumFraction
        )
    {
        // calculate funding payment
        latestCumulativePremiumFraction = getLatestCumulativePremiumFraction(_amm);
        SignedDecimal.signedDecimal memory fundingPayment;
        if (_oldPosition.size.toInt() != 0) {
            fundingPayment = latestCumulativePremiumFraction
                .subD(_oldPosition.lastUpdatedCumulativePremiumFraction)
                .mulD(_oldPosition.size)
                .mulScalar(-1);
        }

        // calculate remain margin
        SignedDecimal.signedDecimal memory signedRemainMargin = fundingPayment.addD(_oldPosition.margin).addD(
            _marginDelta
        );

        // if remain margin is negative, set to zero and leave the rest to bad debt
        if (signedRemainMargin.toInt() < 0) {
            badDebt = signedRemainMargin.abs();
        } else {
            remainMargin = signedRemainMargin.abs();
        }
    }

    function getUnadjustedPosition(IAmm _amm, address _trader) public view returns (Position memory position) {
        position = ammMap[address(_amm)].positionMap[_trader];
    }

    function _msgSender() internal view override(BaseRelayRecipient, ContextUpgradeSafe) returns (address payable) {
        return super._msgSender();
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

    function requireNotRestrictionMode(IAmm _amm) private view {
        uint256 currentBlock = _blockNumber();
        if (currentBlock == ammMap[address(_amm)].lastRestrictionBlock) {
            require(getUnadjustedPosition(_amm, _msgSender()).blockNumber != currentBlock, "only one action allowed");
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
