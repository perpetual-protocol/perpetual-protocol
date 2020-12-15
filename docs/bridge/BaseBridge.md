## `BaseBridge`







### `__BaseBridge_init(contract IAMB _ambBridge, contract IMultiTokenMediator _multiTokenMediator)` (internal)





Parameters:

Returns:
### `setAMBBridge(contract IAMB _ambBridge)` (public)





Parameters:

Returns:
### `setMultiTokenMediator(contract IMultiTokenMediator _multiTokenMediator)` (public)





Parameters:

Returns:
### `erc20Transfer(contract IERC20 _token, address _receiver, struct Decimal.decimal _amount)` (external)





Parameters:

Returns:
### `multiTokenTransfer(contract IERC20 _token, address _receiver, struct Decimal.decimal _amount)` (internal)





Parameters:

Returns:
### `callBridge(address _contractOnOtherSide, bytes _data, uint256 _gasLimit) → bytes32 messageId` (internal)





Parameters:

Returns:
