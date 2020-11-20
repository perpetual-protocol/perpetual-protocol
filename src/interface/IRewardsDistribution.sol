// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Decimal } from "../utils/Decimal.sol";

interface IRewardsDistribution {
    function distributeRewards(Decimal.decimal calldata) external;
}
