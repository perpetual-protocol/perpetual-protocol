## `SignedDecimalMath`



Implements simple signed fixed point math add, sub, mul and div operations.



### `unit(uint8 decimals) → int256` (internal)



Returns 1 in the fixed point representation, with `decimals` decimals.

Parameters:

Returns:
### `addd(int256 x, int256 y) → int256` (internal)



Adds x and y, assuming they are both fixed point with 18 decimals.

Parameters:

Returns:
### `subd(int256 x, int256 y) → int256` (internal)



Subtracts y from x, assuming they are both fixed point with 18 decimals.

Parameters:

Returns:
### `muld(int256 x, int256 y) → int256` (internal)



Multiplies x and y, assuming they are both fixed point with 18 digits.

Parameters:

Returns:
### `muld(int256 x, int256 y, uint8 decimals) → int256` (internal)



Multiplies x and y, assuming they are both fixed point with `decimals` digits.

Parameters:

Returns:
### `divd(int256 x, int256 y) → int256` (internal)



Divides x between y, assuming they are both fixed point with 18 digits.

Parameters:

Returns:
### `divd(int256 x, int256 y, uint8 decimals) → int256` (internal)



Divides x between y, assuming they are both fixed point with `decimals` digits.

Parameters:

Returns:
