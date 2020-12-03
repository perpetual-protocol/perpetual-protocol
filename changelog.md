# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
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