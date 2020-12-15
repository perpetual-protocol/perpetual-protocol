## `InsuranceFund`







### `initialize()` (external)





Parameters:

Returns:
### `addAmm(contract IAmm _amm)` (public)



only owner can call


Parameters:
 - _amm → IAmm address

Returns:
### `removeAmm(contract IAmm _amm)` (external)



only owner can call. no need to call


Parameters:
 - _amm → IAmm address

Returns:
### `shutdownAllAmm()` (external)

shutdown all Amms when fatal error happens


only owner can call. Emit `ShutdownAllAmms` event

Parameters:

Returns:
### `removeToken(contract IERC20 _token)` (external)





Parameters:

Returns:
### `withdraw(contract IERC20 _quoteToken, struct Decimal.decimal _amount)` (external)

withdraw token to caller




Parameters:
 - _amount → the amount of quoteToken caller want to withdraw

Returns:
### `setExchange(contract IExchangeWrapper _exchange)` (external)





Parameters:

Returns:
### `setBeneficiary(address _beneficiary)` (external)





Parameters:

Returns:
### `setMinter(contract IMinter _minter)` (public)





Parameters:

Returns:
### `setInflationMonitor(contract IInflationMonitor _inflationMonitor)` (external)





Parameters:

Returns:
### `getQuoteTokenLength() → uint256` (public)





Parameters:

Returns:
### `getTokenWithMaxValue() → address` (internal)





Parameters:

Returns:
### `swapInput(contract IERC20 inputToken, contract IERC20 outputToken, struct Decimal.decimal inputTokenSold, struct Decimal.decimal minOutputTokenBought) → struct Decimal.decimal received` (internal)





Parameters:

Returns:
### `swapOutput(contract IERC20 inputToken, contract IERC20 outputToken, struct Decimal.decimal outputTokenBought, struct Decimal.decimal maxInputTokenSold) → struct Decimal.decimal received` (internal)





Parameters:

Returns:
### `swapEnoughQuoteAmount(contract IERC20 _quoteToken, struct Decimal.decimal _requiredQuoteAmount)` (internal)





Parameters:

Returns:
### `isExistedAmm(contract IAmm _amm) → bool` (public)





Parameters:

Returns:
### `getAllAmms() → contract IAmm[]` (external)





Parameters:

Returns:
### `isQuoteTokenExisted(contract IERC20 _token) → bool` (internal)





Parameters:

Returns:
### `getOrderedQuoteTokens(contract IERC20 _exceptionQuoteToken) → contract IERC20[] orderedTokens` (internal)





Parameters:

Returns:
### `balanceOf(contract IERC20 _quoteToken) → struct Decimal.decimal` (internal)





Parameters:

Returns:
