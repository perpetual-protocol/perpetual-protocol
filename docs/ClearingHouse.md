## `ClearingHouse`







### `initialize(uint256 _initMarginRatio, uint256 _maintenanceMarginRatio, uint256 _liquidationFeeRatio, contract IInsuranceFund _insuranceFund, address _trustedForwarder)` (public)





Parameters:

Returns:
### `setLiquidationFeeRatio(struct Decimal.decimal _liquidationFeeRatio)` (public)

set liquidation fee ratio


only owner can call


Parameters:
 - _liquidationFeeRatio → new liquidation fee ratio in 18 digits

Returns:
### `setMaintenanceMarginRatio(struct Decimal.decimal _maintenanceMarginRatio)` (public)

set maintenance margin ratio


only owner can call


Parameters:
 - _maintenanceMarginRatio → new maintenance margin ratio in 18 digits

Returns:
### `setFeePool(contract IMultiTokenRewardRecipient _feePool)` (external)





Parameters:

Returns:
### `setWhitelist(address _whitelist)` (external)

add an address in the whitelist. People in the whitelist can hold unlimited positions.


only owner can call


Parameters:
 - _whitelist → an address

Returns:
### `addMargin(contract IAmm _amm, struct Decimal.decimal _addedMargin)` (external)

add margin to increase margin ratio




Parameters:
 - _amm → IAmm address

 - _addedMargin → added margin in 18 digits

Returns:
### `removeMargin(contract IAmm _amm, struct Decimal.decimal _removedMargin)` (external)

remove margin to decrease margin ratio




Parameters:
 - _amm → IAmm address

 - _removedMargin → removed margin in 18 digits

Returns:
### `settlePosition(contract IAmm _amm)` (external)

settle all the positions when amm is shutdown. The settlement price is according to IAmm.settlementPrice




Parameters:
 - _amm → IAmm address

Returns:
### `openPosition(contract IAmm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _leverage, struct Decimal.decimal _baseAssetAmountLimit)` (external)

open a position




Parameters:
 - _amm → amm address

 - _side → enum Side; BUY for long and SELL for short

 - _quoteAssetAmount → quote asset amount in 18 digits. Can Not be 0

 - _leverage → leverage  in 18 digits. Can Not be 0

 - _baseAssetAmountLimit → minimum base asset amount expected to get to prevent from slippage.

Returns:
### `closePosition(contract IAmm _amm, struct Decimal.decimal _quoteAssetAmountLimit)` (external)

close all the positions




Parameters:
 - _amm → IAmm address

Returns:
### `liquidate(contract IAmm _amm, address _trader)` (external)

liquidate trader's underwater position. Require trader's margin ratio less than maintenance margin ratio


liquidator can NOT open any positions in the same block to prevent from price manipulation.


Parameters:
 - _amm → IAmm address

 - _trader → trader address

Returns:
### `payFunding(contract IAmm _amm)` (external)

if funding rate is positive, traders with long position pay traders with short position and vice versa.




Parameters:
 - _amm → IAmm address

Returns:
### `adjustPosition(contract IAmm _amm)` (external)

adjust msg.sender's position when liquidity migration happened




Parameters:
 - _amm → Amm address

Returns:
### `getMarginRatio(contract IAmm _amm, address _trader) → struct SignedDecimal.signedDecimal` (public)

get margin ratio, marginRatio = (margin + funding payments + unrealized Pnl) / openNotional
use spot and twap price to calculate unrealized Pnl, final unrealized Pnl depends on which one is higher




Parameters:
 - _amm → IAmm address

 - _trader → trader address


Returns:
 - margin ratio in 18 digits
### `getPosition(contract IAmm _amm, address _trader) → struct ClearingHouse.Position` (public)

get personal position information, and adjust size if migration is necessary




Parameters:
 - _amm → IAmm address

 - _trader → trader address


Returns:
 - struct Position
### `getPositionNotionalAndUnrealizedPnl(contract IAmm _amm, address _trader, enum ClearingHouse.PnlCalcOption _pnlCalcOption) → struct Decimal.decimal positionNotional, struct SignedDecimal.signedDecimal unrealizedPnl` (public)

get position notional and unrealized Pnl without fee expense and funding payment




Parameters:
 - _amm → IAmm address

 - _trader → trader address

 - _pnlCalcOption → enum PnlCalcOption, SPOT_PRICE for spot price and TWAP for twap price


Returns:
 - positionNotional position notional

 - unrealizedPnl unrealized Pnl
### `getLatestCumulativePremiumFraction(contract IAmm _amm) → struct SignedDecimal.signedDecimal` (public)

get latest cumulative premium fraction.




Parameters:
 - _amm → IAmm address


Returns:
 - latest cumulative premium fraction in 18 digits
### `enterRestrictionMode(contract IAmm _amm)` (internal)





Parameters:

Returns:
### `setPosition(contract IAmm _amm, address _trader, struct ClearingHouse.Position _position)` (internal)





Parameters:

Returns:
### `clearPosition(contract IAmm _amm, address _trader)` (internal)





Parameters:

Returns:
### `internalIncreasePosition(contract IAmm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _openNotional, struct Decimal.decimal _minPositionSize, struct Decimal.decimal _leverage) → struct ClearingHouse.PositionResp positionResp` (internal)





Parameters:

Returns:
### `openReversePosition(contract IAmm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _leverage, struct Decimal.decimal _baseAssetAmountLimit) → struct ClearingHouse.PositionResp` (internal)





Parameters:

Returns:
### `closeAndOpenReversePosition(contract IAmm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _leverage, struct Decimal.decimal _baseAssetAmountLimit) → struct ClearingHouse.PositionResp positionResp` (internal)





Parameters:

Returns:
### `swapInput(contract IAmm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _inputAmount, struct Decimal.decimal _minOutputAmount) → struct SignedDecimal.signedDecimal` (internal)





Parameters:

Returns:
### `transferFee(address _from, contract IAmm _amm, struct Decimal.decimal _positionNotional) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `withdraw(contract IERC20 _token, address _receiver, struct Decimal.decimal _amount)` (internal)





Parameters:

Returns:
### `realizeBadDebt(contract IERC20 _token, struct Decimal.decimal _badDebt)` (internal)





Parameters:

Returns:
### `transferToInsuranceFund(contract IERC20 _token, struct Decimal.decimal _amount)` (internal)





Parameters:

Returns:
### `updateOpenInterestNotional(contract IAmm _amm, struct SignedDecimal.signedDecimal _amount)` (internal)



assume this will be removes soon once the guarded period has ended. caller need to ensure amm exist

Parameters:

Returns:
### `adjustPositionForLiquidityChanged(contract IAmm _amm, address _trader) → struct ClearingHouse.Position` (internal)





Parameters:

Returns:
### `calcPositionAfterLiquidityMigration(contract IAmm _amm, struct ClearingHouse.Position _position, uint256 _latestLiquidityIndex) → struct ClearingHouse.Position` (internal)





Parameters:

Returns:
### `getUnadjustedPosition(contract IAmm _amm, address _trader) → struct ClearingHouse.Position position` (public)





Parameters:

Returns:
### `_msgSender() → address payable` (internal)





Parameters:

Returns:
### `_msgData() → bytes ret` (internal)





Parameters:

Returns:
