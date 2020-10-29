// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "./ConfigurableRightsPool.sol";


interface CRPFactory {
    // Log the address of each new smart pool, and its creator
    event LogNewCrp(address indexed caller, address indexed pool);

    struct Rights {
        bool canPauseSwapping;
        bool canChangeSwapFee;
        bool canChangeWeights;
        bool canAddRemoveTokens;
        bool canWhitelistLPs;
        bool canChangeCap;
    }

    // Function declarations

    /**
     * @notice Create a new CRP
     * @dev emits a LogNewCRP event
     * @param factoryAddress - the BFactory instance used to create the underlying pool
     * @param poolParams - struct containing the names, tokens, weights, balances, and swap fee
     * @param rights - struct of permissions, configuring this CRP instance (see above for definitions)
     */
    function newCrp(
        address factoryAddress,
        ConfigurableRightsPool.PoolParams calldata poolParams,
        Rights calldata rights
    ) external returns (ConfigurableRightsPool);

    /**
     * @notice Check to see if a given address is a CRP
     * @param addr - address to check
     * @return boolean indicating whether it is a CRP
     */
    function isCrp(address addr) external view returns (bool);
}
