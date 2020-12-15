// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../utils/SignedDecimal.sol";

contract SignedDecimalFake {
    using SignedDecimal for SignedDecimal.signedDecimal;

    constructor() public {}

    /// @dev multiple two decimals
    function mul(SignedDecimal.signedDecimal memory x, SignedDecimal.signedDecimal memory y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.mulD(y);
    }

    /// @dev multiple a SignedDecimal.signedDecimal by a int256
    function mulScalar(SignedDecimal.signedDecimal memory x, int256 y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.mulScalar(y);
    }

    /// @dev divide two decimals
    function div(SignedDecimal.signedDecimal memory x, SignedDecimal.signedDecimal memory y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.divD(y);
    }

    /// @dev divide a SignedDecimal.signedDecimal by a int256
    function divScalar(SignedDecimal.signedDecimal memory x, int256 y)
        public
        pure
        returns (SignedDecimal.signedDecimal memory z)
    {
        z = x.divScalar(y);
    }
}
