## `ChainlinkPriceFeed`







### `initialize()` (public)





Parameters:

Returns:
### `addAggregator(bytes32 _priceFeedKey, address _aggregator)` (external)





Parameters:

Returns:
### `removeAggregator(bytes32 _priceFeedKey)` (external)





Parameters:

Returns:
### `getAggregator(bytes32 _priceFeedKey) → contract AggregatorInterface` (public)





Parameters:

Returns:
### `getPrice(bytes32 _priceFeedKey) → uint256` (external)





Parameters:

Returns:
### `getLatestTimestamp(bytes32 _priceFeedKey) → uint256` (external)





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
### `requireAggregatorExisted(contract AggregatorInterface aggregator)` (internal)





Parameters:

Returns:
### `formatUSDPair(uint256 _price) → uint256` (internal)





Parameters:

Returns:
