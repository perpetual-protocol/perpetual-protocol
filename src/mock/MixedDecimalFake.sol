// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../utils/MixedDecimal.sol";

contract MixedDecimalFake {
    using MixedDecimal for SignedDecimal.signedDecimal;

    constructor() public {}

    function fromDecimal(Decimal.decimal memory x) public pure returns (SignedDecimal.signedDecimal memory z) {
        z = MixedDecimal.fromDecimal(x);
    }

    function toUint(SignedDecimal.signedDecimal memory x) public pure returns (uint256) {
        return x.toUint();
    }

    /// @dev multiple a SignedDecimal.signedDecimal by Decimal.decimal
    function mul(SignedDecimal.signedDecimal memory x, Decimal.decimal memory y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.mulD(y);
    }

    /// @dev multiple a SignedDecimal.signedDecimal by a uint256
    function mulScalar(SignedDecimal.signedDecimal memory x, uint256 y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.mulScalar(y);
    }

    /// @dev divide a SignedDecimal.signedDecimal by a Decimal.decimal
    function div(SignedDecimal.signedDecimal memory x, Decimal.decimal memory y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.divD(y);
    }

    /// @dev divide a SignedDecimal.signedDecimal by a uint256
    function divScalar(SignedDecimal.signedDecimal memory x, uint256 y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.divScalar(y);
    }
}
