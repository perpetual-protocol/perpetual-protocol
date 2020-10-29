## `ClearingHouse`







### `initialize(contract AmmMgr _ammMgr, contract ClearingHouseVault _clearingHouseVault, uint256 _initMarginRatio, uint256 _maintenanceMarginRatio, uint256 _liquidationFeeRatio)` (public)





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
### `addToWhitelists(address _addr)` (external)

add an address in the whitelist. People in the whitelist can hold unlimited positions.


only owner can call


Parameters:
 - _addr → an address

Returns:
### `removeFromWhitelists(address _addr)` (external)





Parameters:

Returns:
### `addMargin(contract Amm _amm, struct Decimal.decimal _addedMargin)` (external)

add margin to increase margin ratio




Parameters:
 - _amm → Amm address

 - _addedMargin → added margin in 18 digits

Returns:
### `removeMargin(contract Amm _amm, struct Decimal.decimal _removedMargin)` (external)

remove margin to decrease margin ratio




Parameters:
 - _amm → Amm address

 - _removedMargin → removed margin in 18 digits

Returns:
### `settlePosition(contract Amm _amm)` (external)

settle all the positions when amm is shutdown. The settlement price is according to Amm.settlementPrice




Parameters:
 - _amm → Amm address

Returns:
### `openPosition(contract Amm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _leverage, struct Decimal.decimal _minBaseAssetAmount)` (external)

open a position




Parameters:
 - _amm → amm address

 - _side → enum Side; BUY for long and SELL for short

 - _quoteAssetAmount → quote asset amount in 18 digits. Can Not be 0

 - _leverage → leverage  in 18 digits. Can Not be 0

 - _minBaseAssetAmount → minimum base asset amount expected to get to prevent from slippage.

Returns:
### `closePosition(contract Amm _amm)` (external)

close all the positions




Parameters:
 - _amm → Amm address

Returns:
### `liquidate(contract Amm _amm, address _trader)` (external)

liquidate trader's underwater position. Require trader's margin ratio less than maintenance margin ratio


liquidator can NOT open any positions in the same block to prevent from price manipulation.


Parameters:
 - _amm → Amm address

 - _trader → trader address

Returns:
### `payFunding(contract Amm _amm)` (external)

if funding rate is positive, traders with long position pay traders with short position and vice versa.




Parameters:
 - _amm → Amm address

Returns:
### `getMarginRatio(contract Amm _amm, address _trader) → struct SignedDecimal.signedDecimal` (public)

get margin ratio, marginRatio = (unrealized Pnl + margin) / openNotional
use spot and twap price to calculate unrealized Pnl, final unrealized Pnl depends on which one is higher




Parameters:
 - _amm → Amm address

 - _trader → trader address


Returns:
 - margin ratio in 18 digits
### `getPosition(contract Amm _amm, address _trader) → struct ClearingHouse.Position` (public)

get personal position information




Parameters:
 - _amm → Amm address

 - _trader → trader address


Returns:
 - struct Position
### `getPositionNotionalAndUnrealizedPnl(contract Amm _amm, address _trader, enum ClearingHouse.PnlCalcOption _pnlCalcOption) → struct Decimal.decimal positionNotional, struct SignedDecimal.signedDecimal unrealizedPnl` (public)

get position notional and unrealized Pnl without fee expense and funding payment




Parameters:
 - _amm → Amm address

 - _trader → trader address

 - _pnlCalcOption → enum PnlCalcOption, SPOT_PRICE for spot price and TWAP for twap price


Returns:
 - positionNotional position notional

 - unrealizedPnl unrealized Pnl
### `getLatestCumulativePremiumFraction(contract Amm _amm) → struct SignedDecimal.signedDecimal` (public)

get latest cumulative premium fraction.




Parameters:
 - _amm → Amm address


Returns:
 - latest cumulative premium fraction in 18 digits
### `adjustPositionForLiquidityChanged(contract Amm _amm, address _trader) → struct ClearingHouse.Position` (internal)





Parameters:

Returns:
### `setPosition(contract Amm _amm, address _trader, struct ClearingHouse.Position _position)` (internal)





Parameters:

Returns:
### `deletePosition(contract Amm _amm, address _trader)` (internal)





Parameters:

Returns:
### `internalIncreasePosition(struct ClearingHouse.PositionArgs _positionArgs) → struct ClearingHouse.PositionResp positionResp` (internal)





Parameters:

Returns:
### `internalReducePosition(struct ClearingHouse.PositionArgs _positionArgs) → struct ClearingHouse.PositionResp positionResp` (internal)





Parameters:

Returns:
### `closeAndOpenReversePosition(struct ClearingHouse.PositionArgs _positionArgs) → struct ClearingHouse.PositionResp` (internal)





Parameters:

Returns:
### `swapInput(contract Amm _amm, enum ClearingHouse.Side _side, struct Decimal.decimal _inputAmount, struct Decimal.decimal _minOutputAmount) → struct SignedDecimal.signedDecimal` (internal)





Parameters:

Returns:
### `transferFee(address _from, contract Amm _amm, struct Decimal.decimal _positionNotional) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `isInWhitelists(address _addr) → bool` (internal)





Parameters:

Returns:
### `getUnadjustedPosition(contract Amm _amm, address _trader) → struct ClearingHouse.Position position` (internal)





Parameters:

Returns:
### `getClosedRatio(struct Decimal.decimal closedSize, struct Decimal.decimal originalSize) → struct Decimal.decimal` (internal)





Parameters:

Returns:
