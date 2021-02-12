## `Amm`







### `initialize(uint256 _quoteAssetReserve, uint256 _baseAssetReserve, uint256 _tradeLimitRatio, uint256 _fundingPeriod, contract IPriceFeed _priceFeed, bytes32 _priceFeedKey, address _quoteAsset, uint256 _fluctuationLimitRatio, uint256 _tollRatio, uint256 _spreadRatio)` (public)





Parameters:

Returns:
### `swapInput(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _baseAssetAmountLimit) → struct Decimal.decimal` (external)

Swap your quote asset to base asset, the impact of the price MUST be less than `fluctuationLimitRatio`


Only clearingHouse can call this function


Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short

 - _quoteAssetAmount → quote asset amount

 - _baseAssetAmountLimit → minimum base asset amount expected to get to prevent front running


Returns:
 - base asset amount
### `swapOutput(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetAmountLimit, bool _skipFluctuationCheck) → struct Decimal.decimal` (external)

swap your base asset to quote asset; the impact of the price can be restricted with fluctuationLimitRatio


only clearingHouse can call this function


Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from swapInput

 - _baseAssetAmount → base asset amount

 - _quoteAssetAmountLimit → limit of quote asset amount; for slippage protection

 - _skipFluctuationCheck → false for checking fluctuationLimitRatio; true for no limit, only when closePosition()


Returns:
 - quote asset amount
### `settleFunding() → struct SignedDecimal.signedDecimal` (external)

update funding rate


only allow to update while reaching `nextFundingTime`


Parameters:

Returns:
 - premium fraction of this period in 18 digits
### `migrateLiquidity(struct Decimal.decimal _liquidityMultiplier, struct Decimal.decimal _fluctuationLimitRatio)` (external)





Parameters:

Returns:
### `calcBaseAssetAfterLiquidityMigration(struct SignedDecimal.signedDecimal _baseAssetAmount, struct Decimal.decimal _fromQuoteReserve, struct Decimal.decimal _fromBaseReserve) → struct SignedDecimal.signedDecimal` (public)





Parameters:

Returns:
### `shutdown()` (external)

shutdown amm,


only `globalShutdown` or owner can call this function
The price calculation is in `globalShutdown`.

Parameters:

Returns:
### `setCounterParty(address _counterParty)` (external)

set counter party


only owner can call this function


Parameters:
 - _counterParty → address of counter party

Returns:
### `setGlobalShutdown(address _globalShutdown)` (external)

set `globalShutdown`


only owner can call this function


Parameters:
 - _globalShutdown → address of `globalShutdown`

Returns:
### `setFluctuationLimitRatio(struct Decimal.decimal _fluctuationLimitRatio)` (public)

set fluctuation limit rate. Default value is `1 / max leverage`


only owner can call this function


Parameters:
 - _fluctuationLimitRatio → fluctuation limit rate in 18 digits, 0 means skip the checking

Returns:
### `setSpotPriceTwapInterval(uint256 _interval)` (external)

set time interval for twap calculation, default is 1 hour


only owner can call this function


Parameters:
 - _interval → time interval in seconds

Returns:
### `setOpen(bool _open)` (external)

set `open` flag. Amm is open to trade if `open` is true. Default is false.


only owner can call this function


Parameters:
 - _open → open to trade is true, otherwise is false.

Returns:
### `setTollRatio(struct Decimal.decimal _tollRatio)` (public)

set new toll ratio


only owner can call


Parameters:
 - _tollRatio → new toll ratio in 18 digits

Returns:
### `setSpreadRatio(struct Decimal.decimal _spreadRatio)` (public)

set new spread ratio


only owner can call


Parameters:
 - _spreadRatio → new toll spread in 18 digits

Returns:
### `setCap(struct Decimal.decimal _maxHoldingBaseAsset, struct Decimal.decimal _openInterestNotionalCap)` (public)

set new cap during guarded period, which is max position size that traders can hold


only owner can call. assume this will be removes soon once the guarded period has ended. must be set before opening amm


Parameters:
 - _maxHoldingBaseAsset → max position size that traders can hold in 18 digits

 - _openInterestNotionalCap → open interest cap, denominated in quoteToken

Returns:
### `getInputTwap(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (public)

get input twap amount.
returns how many base asset you will get with the input quote amount based on twap price.




Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short.

 - _quoteAssetAmount → quote asset amount


Returns:
 - base asset amount
### `getOutputTwap(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (public)

get output twap amount.
return how many quote asset you will get with the input base amount on twap price.




Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from `getInputTwap`.

 - _baseAssetAmount → base asset amount


Returns:
 - quote asset amount
### `getInputPrice(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (public)

get input amount. returns how many base asset you will get with the input quote amount.




Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short.

 - _quoteAssetAmount → quote asset amount


Returns:
 - base asset amount
### `getOutputPrice(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (public)

get output price. return how many quote asset you will get with the input base amount




Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from `getInput`.

 - _baseAssetAmount → base asset amount


Returns:
 - quote asset amount
### `getUnderlyingPrice() → struct Decimal.decimal` (public)

get underlying price provided by oracle




Parameters:

Returns:
 - underlying price
### `getUnderlyingTwapPrice(uint256 _intervalInSeconds) → struct Decimal.decimal` (public)

get underlying twap price provided by oracle




Parameters:

Returns:
 - underlying price
### `getSpotPrice() → struct Decimal.decimal` (public)

get spot price based on current quote/base asset reserve.




Parameters:

Returns:
 - spot price
### `getTwapPrice(uint256 _intervalInSeconds) → struct Decimal.decimal` (public)

get twap price



Parameters:

Returns:
### `getReserve() → struct Decimal.decimal, struct Decimal.decimal` (external)

get current quote/base asset reserve.




Parameters:

Returns:
 - quote asset reserve, base asset reserve)
### `getSnapshotLen() → uint256` (external)





Parameters:

Returns:
### `getLiquidityHistoryLength() → uint256` (external)





Parameters:

Returns:
### `getCumulativeNotional() → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `getLatestLiquidityChangedSnapshots() → struct IAmm.LiquidityChangedSnapshot` (public)





Parameters:

Returns:
### `getLiquidityChangedSnapshots(uint256 i) → struct IAmm.LiquidityChangedSnapshot` (external)





Parameters:

Returns:
### `getSettlementPrice() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getBaseAssetDeltaThisFundingPeriod() → struct SignedDecimal.signedDecimal` (external)





Parameters:

Returns:
### `getMaxHoldingBaseAsset() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `getOpenInterestNotionalCap() → struct Decimal.decimal` (external)





Parameters:

Returns:
### `calcFee(struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal, struct Decimal.decimal` (external)

calculate total fee (including toll and spread) by input quoteAssetAmount




Parameters:
 - _quoteAssetAmount → quoteAssetAmount


Returns:
 - total tx fee
### `getInputPriceWithReserves(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `getOutputPriceWithReserves(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `addReserveSnapshot()` (internal)





Parameters:

Returns:
### `implSwapOutput(enum IAmm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetAmountLimit, bool _skipFluctuationCheck) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `updateReserve(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _baseAssetAmount, bool _skipFluctuationCheck)` (internal)





Parameters:

Returns:
### `implGetInputAssetTwapPrice(enum IAmm.Dir _dir, struct Decimal.decimal _assetAmount, enum Amm.QuoteAssetDir _inOut, uint256 _interval) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `implGetReserveTwapPrice(uint256 _interval) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `calcTwap(struct Amm.TwapPriceCalcParams _params, uint256 _interval) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `getPriceWithSpecificSnapshot(struct Amm.TwapPriceCalcParams params) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `isSingleTxOverFluctuation(enum IAmm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _baseAssetAmount) → bool` (internal)





Parameters:

Returns:
### `checkFluctuationLimit(struct Decimal.decimal _fluctuationLimitRatio)` (internal)





Parameters:

Returns:
### `checkLiquidityMultiplierLimit(struct SignedDecimal.signedDecimal _positionSize, struct Decimal.decimal _liquidityMultiplier)` (internal)





Parameters:

Returns:
### `isOverFluctuationLimit(struct Decimal.decimal _price, struct Decimal.decimal _fluctuationLimitRatio, struct Amm.ReserveSnapshot _snapshot) → bool` (internal)





Parameters:

Returns:
### `implShutdown()` (internal)





Parameters:

Returns:
