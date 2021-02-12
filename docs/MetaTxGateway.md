## `MetaTxGateway`







### `initialize(string _name, string _version, uint256 _chainIdL1)` (public)





Parameters:

Returns:
### `addToWhitelists(address _addr)` (external)

add an address to the whitelist. Only contracts in the whitelist can be executed by this gateway.
This prevents the gateway from being abused to execute arbitrary meta txs


only owner can call


Parameters:
 - _addr → an address

Returns:
### `removeFromWhitelists(address _addr)` (external)





Parameters:

Returns:
### `executeMetaTransaction(address from, address to, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) → bytes` (external)





Parameters:

Returns:
### `getNonce(address user) → uint256 nonce` (external)





Parameters:

Returns:
### `isInWhitelists(address _addr) → bool` (public)





Parameters:

Returns:
### `getChainID() → uint256 id` (internal)





Parameters:

Returns:
### `toTypedMessageHash(bytes32 domainSeperator, bytes32 messageHash) → bytes32` (internal)

Accept message hash and returns hash message in EIP712 compatible form
So that it can be used to recover signer from signature signed using EIP712 formatted data
https://eips.ethereum.org/EIPS/eip-712
"\\x19" makes the encoding deterministic
"\\x01" is the version byte to make it compatible to EIP-191



Parameters:

Returns:
### `hashMetaTransaction(struct MetaTxGateway.MetaTransaction metaTx) → bytes32` (internal)





Parameters:

Returns:
### `verify(address user, bytes32 domainSeperator, struct MetaTxGateway.MetaTransaction metaTx, bytes32 sigR, bytes32 sigS, uint8 sigV) → bool` (internal)





Parameters:

Returns:
