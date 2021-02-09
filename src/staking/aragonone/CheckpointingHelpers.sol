// source: https://github.com/aragonone/voting-connectors/blob/master/shared/contract-utils/contracts/CheckpointingHelpers.sol

pragma solidity 0.6.9;

library CheckpointingHelpers {
    uint256 private constant MAX_UINT64 = uint64(-1);
    uint256 private constant MAX_UINT192 = uint192(-1);

    string private constant ERROR_UINT64_TOO_BIG = "UINT64_NUMBER_TOO_BIG";
    string private constant ERROR_UINT192_TOO_BIG = "UINT192_NUMBER_TOO_BIG";

    function toUint64Time(uint256 _a) internal pure returns (uint64) {
        require(_a <= MAX_UINT64, ERROR_UINT64_TOO_BIG);
        return uint64(_a);
    }

    function toUint192Value(uint256 _a) internal pure returns (uint192) {
        require(_a <= MAX_UINT192, ERROR_UINT192_TOO_BIG);
        return uint192(_a);
    }
}
