## `Amm`







### `initialize(uint256 _quoteAssetReserve, uint256 _baseAssetReserve, uint256 _tradeLimitRatio, uint256 _fundingPeriod, contract IPriceFeed _priceFeed, bytes32 _priceFeedKey, address _quoteAsset, uint256 _fluctuation)` (public)





Parameters:

Returns:
### `swapInputWithMinBaseAsset(enum Amm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _minValueOfBaseAssetAmount) → struct Decimal.decimal` (external)

Swap your quote asset to base asset, the impact of the price MUST be less than `fluctuation`


Only clearingHouse can call this function


Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short

 - _quoteAssetAmount → quote asset amount

 - _minValueOfBaseAssetAmount → minimum base asset amount expected to get to prevent front running


Returns:
 - base asset amount
### `swapOutput(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (external)

swap your base asset to quote asset, the impact of the price MUST be less than `fluctuation`


only clearingHouse can call this function


Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from swapInputWithMinBaseAsset

 - _baseAssetAmount → base asset amount


Returns:
 - quote asset amount
### `forceSwapOutput(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (external)

swap your base asset to quote asset without `fluctuation` limitation. Designed for `closePosition`


only clearingHouse can call this function


Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from swapInputWithMinBaseAsset

 - _baseAssetAmount → base asset amount


Returns:
 - quote asset amount
### `settleFunding() → struct SignedDecimal.signedDecimal` (external)

update funding rate


only allow to update while reaching `nextFundingTime`


Parameters:

Returns:
 - premium fraction of this period in 18 digits
### `migrateLiquidity(struct Decimal.decimal _newQuoteReserve, struct Decimal.decimal _newBaseReserve, struct Decimal.decimal _expansionRatio)` (public)

migrate liquidity. The new quote/base asset reserve are calculated in `ammMgr`.


only `ammMgr` can call.


Parameters:
 - _newQuoteReserve → the value of new quote asset reserve

 - _newBaseReserve → the value of new base asset reserve

 - _expansionRatio → position expansion ratio in 18 digits

Returns:
### `shutdown(struct Decimal.decimal _settlementPrice)` (public)

shutdown amm,


only `AmmMgr` can call this function


Parameters:
 - _settlementPrice → settlement price. The price is based on sum of position value and sum of position size.
The price calculation is in `AmmMgr`.

Returns:
### `setCounterParty(address _counterParty)` (external)

set counter party


only owner can call this function


Parameters:
 - _counterParty → address of counter party

Returns:
### `setAmmMgr(address _ammMgr)` (external)

set `ammMgr`


only owner can call this function


Parameters:
 - _ammMgr → address of `ammMgr`

Returns:
### `setFluctuation(struct Decimal.decimal _fluctuation)` (public)

set fluctuation rate. Default value is `1 / max leverage`


only owner can call this function


Parameters:
 - _fluctuation → fluctuation rate in 18 digits, 0 means skip the checking

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
### `getInputTwap(enum Amm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (public)

get input twap amount.
returns how many base asset you will get with the input quote amount based on twap price.




Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short.

 - _quoteAssetAmount → quote asset amount


Returns:
 - base asset amount
### `getOutputTwap(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (public)

get output twap amount.
return how many quote asset you will get with the input base amount on twap price.




Parameters:
 - _dir → ADD_TO_AMM for short, REMOVE_FROM_AMM for long, opposite direction from `getInputTwap`.

 - _baseAssetAmount → base asset amount


Returns:
 - quote asset amount
### `getInputPrice(enum Amm.Dir _dir, struct Decimal.decimal _quoteAssetAmount) → struct Decimal.decimal` (public)

get input amount. returns how many base asset you will get with the input quote amount.




Parameters:
 - _dir → ADD_TO_AMM for long, REMOVE_FROM_AMM for short.

 - _quoteAssetAmount → quote asset amount


Returns:
 - base asset amount
### `getOutputPrice(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount) → struct Decimal.decimal` (public)

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
### `addReserveSnapshot()` (internal)





Parameters:

Returns:
### `implSwapOutput(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount, bool _skipFluctuationCheck) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `updateReserve(enum Amm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _baseAssetAmount, bool _skipFluctuationCheck)` (internal)





Parameters:

Returns:
### `implGetInputAssetTwapPrice(enum Amm.Dir _dir, struct Decimal.decimal _assetAmount, enum Amm.QuoteAssetDir _inOut, uint256 _interval) → struct Decimal.decimal` (internal)





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
### `isOverPriceFluctuation(struct Decimal.decimal _price) → bool` (internal)





Parameters:

Returns:
### `getInputPriceWithReserves(enum Amm.Dir _dir, struct Decimal.decimal _quoteAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (internal)





Parameters:

Returns:
### `getOutputPriceWithReserves(enum Amm.Dir _dir, struct Decimal.decimal _baseAssetAmount, struct Decimal.decimal _quoteAssetPoolAmount, struct Decimal.decimal _baseAssetPoolAmount) → struct Decimal.decimal` (internal)





Parameters:

Returns:
