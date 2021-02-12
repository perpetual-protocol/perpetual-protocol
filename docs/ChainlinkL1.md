## `ChainlinkL1`







### `initialize(address _rootBridge, address _priceFeedL2)` (public)





Parameters:

Returns:
### `setRootBridge(address _rootBridge)` (public)





Parameters:

Returns:
### `setPriceFeedL2(address _priceFeedL2)` (public)





Parameters:

Returns:
### `addAggregator(bytes32 _priceFeedKey, address _aggregator)` (external)





Parameters:

Returns:
### `removeAggregator(bytes32 _priceFeedKey)` (external)





Parameters:

Returns:
### `getAggregator(bytes32 _priceFeedKey) → contract AggregatorV3Interface` (public)





Parameters:

Returns:
### `updateLatestRoundData(bytes32 _priceFeedKey)` (external)





Parameters:

Returns:
### `requireNonEmptyAddress(address _addr)` (internal)





Parameters:

Returns:
### `formatDecimals(uint256 _price, uint8 _decimals) → uint256` (internal)





Parameters:

Returns:
