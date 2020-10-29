## `StakingReserve`







### `initialize(contract PerpToken _perpToken, contract SupplySchedule _supplySchedule, contract AmmMgr _ammMgr, uint256 _vestingPeriod)` (public)





Parameters:

Returns:
### `setVestingPeriod(uint256 _vestingPeriod)` (external)





Parameters:

Returns:
### `stake(struct Decimal.decimal _amount)` (public)



staker can increase staking any time,

Parameters:

Returns:
### `unstake(struct Decimal.decimal _amount)` (external)



staker can decrease staking from stakeBalanceForNextEpoch

Parameters:

Returns:
### `depositAndStake(struct Decimal.decimal _amount)` (external)





Parameters:

Returns:
### `withdraw(struct Decimal.decimal _amount)` (external)





Parameters:

Returns:
### `notifyRewardAmount(struct Decimal.decimal _amount)` (external)



add epoch reward, update totalEffectiveStakeMap

Parameters:

Returns:
### `claimFeesAndVestedReward()` (external)





Parameters:

Returns:
### `nextEpochIndex() → uint256` (public)





Parameters:

Returns:
### `getTotalBalance() → struct Decimal.decimal` (public)

everyone can query total balance to check current collateralization ratio.
TotalBalance of time weighted locked PERP for coming epoch



Parameters:

Returns:
### `getTotalEffectiveStake(uint256 _epochIndex) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `getFeeOfEpoch(uint256 _epoch, address _token) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `getFeeRevenue(address _staker) → struct AmmMgr.FeeBalance[] feeBalance` (public)





Parameters:

Returns:
### `getVestedReward(address _staker) → struct Decimal.decimal reward` (public)





Parameters:

Returns:
### `getUnlockedBalance(address _staker) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `getUnstakableBalance(address _staker) → struct Decimal.decimal` (public)





Parameters:

Returns:
### `getLockedBalance(address _staker, uint256 _epochIndex) → struct StakingReserve.LockedBalance` (public)





Parameters:

Returns:
### `getEpochRewardHistoryLength() → uint256` (external)





Parameters:

Returns:
### `getRewardEpochCursor(address _staker) → uint256` (public)





Parameters:

Returns:
### `getFeeEpochCursor(address _staker) → uint256` (public)





Parameters:

Returns:
