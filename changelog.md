# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- add `Amm::getBaseAssetDelta()`
- add `StakedPerpToken.sol` for staking; inherit from `aragonone/Checkpointing.sol` #105 
- add `PerpRewardVesting.sol` for distributing staking reward; inherit from `Balancer/MerkleRedeem.sol` #106
- add `TollPool.sol` for distributing toll #113
- add `TmpRewardPoolL1.sol` for receiving and transferring toll to feeRewardPool #115
- add `FeeRewardPoolL1.sol` for calculating users' rewards and for users to withdraw rewards; fork from `Unipool.sol` #120
- add `KeeperRewardL1.sol` and `KeeperRewardL2.sol` #61

### Changed
- rename `ClearingHouse` interface from `feePool` to `tollPool`
- rename `ClearingHouse` interface from `setFeePool` to `setTollPool`
### Removed
- remove `Amm::migrateLiquidity()`

## [1.0.4] - 2020-12-10
### Added
- add `fundingPayment` to `ClearingHouse::PositionChanged` and `ClearingHouse::MarginChanged` #95
- add `spotPrice` to `ClearingHouse::PositionChanged` #95
- index `trader` and `amm` in position-related events #95

### Removed
- `IAmm::getReserve` #95
- remove `quotAssetReserve` and `baseAssetReserve` from `ClearingHouse::PositionChanged` event #95

## [0.13.3] - 2020-12-03
### Added
- add `ClearingHouse::adjustPositionForLiquidityChanged()` #68
### Changed
- change ClearingHouse's event `PositionAdjusted.newPositionSize` parameter's type from `uint256` to `int256` #68
- change error message from both "Margin ratio is larger than min requirement" and "marginRatio not enough" to "Margin ratio not meet criteria" #72

## [0.13.0] - 2020-11-26
### Added
- add `ClearingHouse::openInterestNotional` and `Amm::openInterestNotionalCap` #58
### Changed
- merged event `ClearingHouse::MarginAdded` and `ClearingHouse::MarginRemoved` into `ClearingHouse::MarginChanged` #58
- change `ClearingHouse::whitelistMap` to `ClearingHouse::whitelist` #58

## [0.12.10] - 2020-11-20
### Added
- add event `ClearingHouse::FeePoolSet` #28
- add event `ClearingHouse::WhitelistChanged` #28

### Changed
- add argument `_fluctuationLimitRatio` to `Amm::migrateLiquidity` #54
- the params of event `ClearingHouse::PositionChanged` has changed (`side` -> removed, `exchangedPositionSize` -> signed value, add `margin` and `unrealizedPnl`) #28
- function name has changed #1640(monorepo)
  - `Amm::settlementPrice` -> `Amm::getSettlementPrice`
  - `Amm::baseAssetDeltaThisFundingPeriod` --> `Amm::getBaseAssetDeltaThisFundingPeriod`
  - `Amm::cumulativePositionMultiplier` --> `Amm::getCumulativePositionMultiplier`
  - `Amm::maxHoldingBaseAsset` --> `Amm::getMaxHoldingBaseAsset`

## [0.12.4] - 2020-11-02
### Added
- add `Amm::getUnderlyingTwapPrice` #16

### Changed
- the definition of `ClearingHouse::getPosition` has changed (the size becomes dynamic after liquidity migration) #5
- the params of event `ClearingHouse::PositionAdjusted` has changed (`oldLiquidityBasis` -> `oldLiquidityIndex`, `newLiquidityBasis` -> `newLiquidityIndex`) #5
- the params of struct `ClearingHouse::Position` has changed (`liquidityBasis` -> `liquidityHistoryIndex`) #5