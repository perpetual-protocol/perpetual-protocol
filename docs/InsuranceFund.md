## `InsuranceFund`







### `initialize(contract IERC20 _quoteToken)` (external)





Parameters:

Returns:
### `addToken(contract IERC20 _token)` (external)





Parameters:

Returns:
### `removeToken(contract IERC20 _token)` (external)





Parameters:

Returns:
### `getTokenWithMaxValue() → address` (internal)





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
### `setMinter(contract Minter _minter)` (public)





Parameters:

Returns:
### `getQuoteTokenLength() → uint256` (public)





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
### `isQuoteTokenExisted(contract IERC20 _token) → bool` (internal)





Parameters:

Returns:
### `getOrderedQuoteTokens(contract IERC20 _exceptionQuoteToken) → contract IERC20[] orderedTokens` (internal)





Parameters:

Returns:
### `getTokenIndex(contract IERC20 _token) → int256` (internal)





Parameters:

Returns:
### `balanceOf(contract IERC20 _quoteToken) → struct Decimal.decimal` (internal)





Parameters:

Returns:
