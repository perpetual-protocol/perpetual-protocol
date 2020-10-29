## `DecimalMath`



Implements simple fixed point math add, sub, mul and div operations.




### `unit(uint8 decimals) → uint256` (internal)



Returns 1 in the fixed point representation, with `decimals` decimals.

Parameters:

Returns:
### `addd(uint256 x, uint256 y) → uint256` (internal)



Adds x and y, assuming they are both fixed point with 18 decimals.

Parameters:

Returns:
### `subd(uint256 x, uint256 y) → uint256` (internal)



Subtracts y from x, assuming they are both fixed point with 18 decimals.

Parameters:

Returns:
### `muld(uint256 x, uint256 y) → uint256` (internal)



Multiplies x and y, assuming they are both fixed point with 18 digits.

Parameters:

Returns:
### `muld(uint256 x, uint256 y, uint8 decimals) → uint256` (internal)



Multiplies x and y, assuming they are both fixed point with `decimals` digits.

Parameters:

Returns:
### `divd(uint256 x, uint256 y) → uint256` (internal)



Divides x between y, assuming they are both fixed point with 18 digits.

Parameters:

Returns:
### `divd(uint256 x, uint256 y, uint8 decimals) → uint256` (internal)



Divides x between y, assuming they are both fixed point with `decimals` digits.

Parameters:

Returns:
