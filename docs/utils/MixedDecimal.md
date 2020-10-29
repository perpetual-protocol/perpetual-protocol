## `MixedDecimal`



To handle a signedDecimal add/sub/mul/div a decimal and provide convert decimal to signedDecimal helper



### `fromDecimal(struct Decimal.decimal x) → struct SignedDecimal.signedDecimal` (internal)





Parameters:

Returns:
### `toUint(struct SignedDecimal.signedDecimal x) → uint256` (internal)





Parameters:

Returns:
### `addD(struct SignedDecimal.signedDecimal x, struct Decimal.decimal y) → struct SignedDecimal.signedDecimal` (internal)



add SignedDecimal.signedDecimal and Decimal.decimal, using SignedSafeMath directly

Parameters:

Returns:
### `subD(struct SignedDecimal.signedDecimal x, struct Decimal.decimal y) → struct SignedDecimal.signedDecimal` (internal)



subtract SignedDecimal.signedDecimal by Decimal.decimal, using SignedSafeMath directly

Parameters:

Returns:
### `mulD(struct SignedDecimal.signedDecimal x, struct Decimal.decimal y) → struct SignedDecimal.signedDecimal` (internal)



multiple a SignedDecimal.signedDecimal by Decimal.decimal

Parameters:

Returns:
### `mulScalar(struct SignedDecimal.signedDecimal x, uint256 y) → struct SignedDecimal.signedDecimal` (internal)



multiple a SignedDecimal.signedDecimal by a uint256

Parameters:

Returns:
### `divD(struct SignedDecimal.signedDecimal x, struct Decimal.decimal y) → struct SignedDecimal.signedDecimal` (internal)



divide a SignedDecimal.signedDecimal by a Decimal.decimal

Parameters:

Returns:
### `divScalar(struct SignedDecimal.signedDecimal x, uint256 y) → struct SignedDecimal.signedDecimal` (internal)



divide a SignedDecimal.signedDecimal by a uint256

Parameters:

Returns:
