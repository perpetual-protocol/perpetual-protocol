## `ClearingHouseViewer`







### `constructor(contract ClearingHouse _clearingHouse)` (public)





Parameters:

Returns:
### `getUnrealizedPnl(contract IAmm _amm, address _trader, enum ClearingHouse.PnlCalcOption _pnlCalcOption) → struct SignedDecimal.signedDecimal` (external)

get unrealized PnL




Parameters:
 - _amm → IAmm address

 - _trader → trader address

 - _pnlCalcOption → ClearingHouse.PnlCalcOption, can be SPOT_PRICE or TWAP.


Returns:
 - unrealized PnL in 18 digits
### `getPersonalBalanceWithFundingPayment(contract IERC20 _quoteToken, address _trader) → struct Decimal.decimal margin` (external)

get personal balance with funding payment




Parameters:
 - _quoteToken → ERC20 token address

 - _trader → trader address


Returns:
 - margin personal balance with funding payment in 18 digits
### `getPersonalPositionWithFundingPayment(contract IAmm _amm, address _trader) → struct ClearingHouse.Position position` (public)

get personal position with funding payment




Parameters:
 - _amm → IAmm address

 - _trader → trader address


Returns:
 - position ClearingHouse.Position struct
### `isPositionNeedToBeMigrated(contract IAmm _amm, address _trader) → bool` (external)

verify if trader's position needs to be migrated




Parameters:
 - _amm → IAmm address

 - _trader → trader address


Returns:
 - true if trader's position is not at the latest Amm curve, otherwise is false
### `getMarginRatio(contract IAmm _amm, address _trader) → struct SignedDecimal.signedDecimal` (external)

get personal margin ratio




Parameters:
 - _amm → IAmm address

 - _trader → trader address


Returns:
 - personal margin ratio in 18 digits
