## `AmmMgr`







### `initialize()` (public)





Parameters:

Returns:
### `addAmm(contract Amm _amm, struct Decimal.decimal _tollRatio, struct Decimal.decimal _spreadRatio, struct Decimal.decimal _maxHoldingBaseAsset)` (public)

add an Amm in AmmMgr


only owner can call


Parameters:
 - _amm → Amm address

 - _tollRatio → toll ratio in 18 digits

 - _spreadRatio → spread ratio in 18 digit

Returns:
### `removeAmm(contract Amm _amm)` (external)

remove an Amm from AmmMgr


only owner can call


Parameters:
 - _amm → Amm address

Returns:
### `increaseToll(contract Amm _amm, struct Decimal.decimal _toll)` (external)

increase the value of toll in ammMgr while getting new toll


only clearingHouse can call


Parameters:
 - _amm → amm address

 - _toll → toll in 18 digits

Returns:
### `calcFee(contract Amm _amm, struct Decimal.decimal _positionNotional) → struct Decimal.decimal, struct Decimal.decimal` (external)

calculate total fee (including toll and spread) by input position notional




Parameters:
 - _positionNotional → position notional


Returns:
 - total tx fee
### `settleFees() → struct AmmMgr.FeeBalance[]` (external)

settle toll to feePool


only feePool can call


Parameters:

Returns:
 - array of FeeBalance
### `migrateLiquidity(contract Amm _amm, struct Decimal.decimal _ratio)` (external)

migrate Amm liquidity


only owner can call


Parameters:
 - _amm → amm address

 - _ratio → liquidity ratio applied to _amm in 18 digits

Returns:
### `shutdownAllAmm()` (external)

shutdown all Amms when fatal error happens


only owner can call. Emit `ShutdownAllAmms` event

Parameters:

Returns:
### `shutdownAmm(contract Amm _amm)` (external)

shutdown an Amm


only owner can call. Emit `ShutdownAmm` event


Parameters:
 - _amm → Amm address

Returns:
### `setTollRatio(contract Amm _amm, struct Decimal.decimal _tollRatio)` (public)

set new toll ratio


only owner can call


Parameters:
 - _amm → Amm address

 - _tollRatio → new toll ratio in 18 digits

Returns:
### `setSpreadRatio(contract Amm _amm, struct Decimal.decimal _spreadRatio)` (public)

set new spread ratio


only owner can call


Parameters:
 - _amm → Amm address

 - _spreadRatio → new toll spread in 18 digits

Returns:
### `setClearingHouse(address _clearingHouse)` (external)

set clearingHouse address for access control


only owner can call


Parameters:
 - _clearingHouse → clearingHouse address

Returns:
### `setFeePool(address _feePool)` (external)

set feePool address for access control


only owner can call


Parameters:
 - _feePool → feePool address

Returns:
### `setInflationMonitor(contract InflationMonitor _inflationMonitor)` (external)





Parameters:

Returns:
### `setMaxHoldingBaseAsset(contract Amm _amm, struct Decimal.decimal _maxHoldingBaseAsset)` (public)

set new maxHoldingBaseAsset, which is max position size that traders can hold


only owner can call


Parameters:
 - _amm → Amm address

 - _maxHoldingBaseAsset → new max base asset that traders can hold in 18 digits

Returns:
### `getTotalToll(contract IERC20 _quoteToken) → struct Decimal.decimal totalToll` (external)

get total toll amount of _quoteToken




Parameters:
 - _quoteToken → quote token


Returns:
 - totalToll total toll amount in 18 digits
### `isExistedAmm(contract Amm _amm) → bool` (public)

check if _amm existed in ammMgr




Parameters:
 - _amm → Amm address


Returns:
 - true if existed, false otherwise
### `getAmms(contract IERC20 _quoteToken) → contract Amm[]` (public)

get Amm addresses those support the quote token




Parameters:
 - _quoteToken → quote token address


Returns:
 - array of Amm addresses
### `getSupportedQuoteTokens() → contract IERC20[]` (external)

get all supported quote tokens




Parameters:

Returns:
 - array of quote tokens
### `getMaxHoldingBaseAsset(contract Amm _amm) → struct Decimal.decimal` (external)

get max holding base asset




Parameters:
 - _amm → Amm address


Returns:
 - max holding base asset in 18 digits
### `addSupportedQuoteToken(contract IERC20 _quoteToken)` (internal)





Parameters:

Returns:
### `removeSupportedQuoteToken(contract IERC20 _quoteToken)` (internal)





Parameters:

Returns:
### `getLiquidityChangedHistoryItem(contract Amm _amm, uint256 _index) → struct AmmMgr.LiquidityChangedHistoryItem` (public)





Parameters:

Returns:
### `getLiquidityChangedHistoryLength(contract Amm _amm) → uint256` (public)





Parameters:

Returns:
### `getLatestLiquidityChangedHistoryItem(contract Amm _amm) → struct AmmMgr.LiquidityChangedHistoryItem` (public)





Parameters:

Returns:
### `implShutdownAmm(contract Amm _amm) → struct Decimal.decimal` (internal)





Parameters:

Returns:
