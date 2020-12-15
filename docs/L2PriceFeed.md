## `L2PriceFeed`







### `initialize(address _ambBridge, address _rootBridge)` (public)





Parameters:

Returns:
### `addAggregator(bytes32 _priceFeedKey)` (external)





Parameters:

Returns:
### `removeAggregator(bytes32 _priceFeedKey)` (external)





Parameters:

Returns:
### `setRootBridge(address _rootBridge)` (external)





Parameters:

Returns:
### `setLatestData(bytes32 _priceFeedKey, uint256 _price, uint256 _timestamp, uint256 _roundId)` (external)





Parameters:

Returns:
### `getPrice(bytes32 _priceFeedKey) → uint256` (external)





Parameters:

Returns:
### `getLatestTimestamp(bytes32 _priceFeedKey) → uint256` (public)





Parameters:

Returns:
### `getTwapPrice(bytes32 _priceFeedKey, uint256 _interval) → uint256` (external)





Parameters:

Returns:
### `getPreviousPrice(bytes32 _priceFeedKey, uint256 _numOfRoundBack) → uint256` (public)





Parameters:

Returns:
### `getPreviousTimestamp(bytes32 _priceFeedKey, uint256 _numOfRoundBack) → uint256` (public)





Parameters:

Returns:
### `getPriceFeedLength(bytes32 _priceFeedKey) → uint256 length` (public)





Parameters:

Returns:
### `getLatestRoundId(bytes32 _priceFeedKey) → uint256` (internal)





Parameters:

Returns:
