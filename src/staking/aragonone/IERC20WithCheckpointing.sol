// source: https://github.com/aragonone/voting-connectors/blob/master/shared/contract-utils/contracts/interfaces/IERC20WithCheckpointing.sol

/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.6.9;

interface IERC20WithCheckpointing {
    function balanceOfAt(address _owner, uint256 _blockNumber) external view returns (uint256);

    function totalSupplyAt(uint256 _blockNumber) external view returns (uint256);
}
