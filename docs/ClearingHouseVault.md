## `ClearingHouseVault`







### `initialize(contract InsuranceFund _insuranceFund)` (public)





Parameters:

Returns:
### `setClearingHouse(address _clearingHouse)` (external)

set clearingHouse dependency


only owner can call


Parameters:
 - _clearingHouse → address

Returns:
### `withdraw(contract IERC20 _token, address _receiver, struct Decimal.decimal _amount)` (public)

withdraw token to trader/liquidator


only clearingHouse can call


Parameters:
 - _token → ERC20 token address

 - _receiver → receiver, could be trader or liquidator

 - _amount → token amount

Returns:
### `realizeBadDebt(contract IERC20 _token, struct Decimal.decimal _badDebt)` (external)

realize bad debt. If _badDebt is lager than prepaidBadDebt, ask insuranceFund to pay the loss


only clearingHouse can call


Parameters:
 - _token → ERC20 token address

 - _badDebt → amount of the bad debt

Returns:
### `transferFromInsuranceFund(contract IERC20 _token, struct Decimal.decimal _amount)` (public)

withdraw erc20 token from insuranceFund


only clearingHouse can call


Parameters:
 - _token → ERC20 token address

 - _amount → requested amount

Returns:
### `transferToInsuranceFund(contract IERC20 _token, struct Decimal.decimal _amount)` (external)

transfer erc20 token to insuranceFund


only clearingHouse can call


Parameters:
 - _token → ERC20 token address

 - _amount → amount to transfer to

Returns:
