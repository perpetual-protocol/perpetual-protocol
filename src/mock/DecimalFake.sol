// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../utils/Decimal.sol";

contract DecimalFake {
    using Decimal for Decimal.decimal;

    constructor() public {}

    /// @dev multiple two decimals
    function mul(Decimal.decimal memory x, Decimal.decimal memory y) public pure returns (Decimal.decimal memory z) {
        z = x.mulD(y);
    }

    /// @dev multiple a Decimal.decimal by a uint256
    function mulScalar(Decimal.decimal memory x, uint256 y) public pure returns (Decimal.decimal memory z) {
        z = x.mulScalar(y);
    }

    /// @dev divide two decimals
    function div(Decimal.decimal memory x, Decimal.decimal memory y) public pure returns (Decimal.decimal memory z) {
        z = x.divD(y);
    }

    /// @dev divide a Decimal.decimal by a uint256
    function divScalar(Decimal.decimal memory x, uint256 y) public pure returns (Decimal.decimal memory z) {
        z = x.divScalar(y);
    }
}
