## `Minter`







### `initialize(contract PerpToken _perpToken)` (public)

pre-minted tokens will transfer to the contract creator
(contract creator will be admin, minter and pauser),
but mint() will transfer to the minter (because only minter can mint)
openzeppelin doesn't support struct input
https://github.com/OpenZeppelin/openzeppelin-sdk/issues/1523



Parameters:

Returns:
### `mintReward()` (external)





Parameters:

Returns:
### `mintForLoss(struct Decimal.decimal _amount)` (public)





Parameters:

Returns:
### `setInsuranceFund(address _insuranceFund)` (external)





Parameters:

Returns:
### `setRewardsDistribution(contract RewardsDistribution _rewardsDistribution)` (external)





Parameters:

Returns:
### `setSupplySchedule(contract SupplySchedule _supplySchedule)` (external)





Parameters:

Returns:
### `setInflationMonitor(contract InflationMonitor _inflationMonitor)` (external)





Parameters:

Returns:
