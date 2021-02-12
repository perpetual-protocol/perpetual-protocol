## `IAmm`







### `swapInput(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _baseAssetAmountLimit) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `swapOutput(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetAmountLimit, bool _skipFluctuationCheck) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `migrateLiquidity(struct Decimal.decimal _liquidityMultiplier, struct Decimal.decimal _priceLimitRatio)` (external)





Parameters:

Returns:
### `shutdown()` (external)





Parameters:

Returns:
### `settleFunding() → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `calcFee(struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal, struct Decimal.decimal` (external)





Parameters:

Returns:
### `calcBaseAssetAfterLiquidityMigration(struct SignedDecimal.signedDecimal _baseAssetAmount, struct Decimal.decimal _fromQuoteReserve, struct Decimal.decimal _fromBaseReserve) → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `getInputTwap(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getOutputTwap(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getInputPrice(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getOutputPrice(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getInputPriceWithReserves(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getOutputPriceWithReserves(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getSpotPrice() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getLiquidityHistoryLength() → uint256` (external)





Parameters:

Returns:
### `quoteAsset() → contract IERC20` (external)





Parameters:

Returns:
### `open() → bool` (external)





Parameters:

Returns:
### `getSettlementPrice() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getBaseAssetDeltaThisFundingPeriod() → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `getCumulativeNotional() → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `getMaxHoldingBaseAsset() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getOpenInterestNotionalCap() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getLiquidityChangedSnapshots(uint256 i) → struct IAmm.LiquidityChangedSnapshot` (external)





Parameters:

Returns:
