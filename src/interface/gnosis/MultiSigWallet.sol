// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

interface MultiSigWallet {
    /*
     *  Events
     */
    event Confirmation(address indexed sender, uint256 indexed transactionId);
    event Revocation(address indexed sender, uint256 indexed transactionId);
    event Submission(uint256 indexed transactionId);
    event Execution(uint256 indexed transactionId);
    event ExecutionFailure(uint256 indexed transactionId);
    event Deposit(address indexed sender, uint256 value);
    event OwnerAddition(address indexed owner);
    event OwnerRemoval(address indexed owner);
    event RequirementChange(uint256 required);

    /*
     *  Functions
     */
    function addOwner(address owner) external;

    function removeOwner(address owner) external;

    function replaceOwner(address owner, address newOwner) external;

    function changeRequirement(uint256 _required) external;

    function submitTransaction(
        address destination,
        uint256 value,
        bytes calldata data
    ) external returns (uint256 transactionId);

    function confirmTransaction(uint256 transactionId) external;

    function revokeConfirmation(uint256 transactionId) external;

    function executeTransaction(uint256 transactionId) external;

    function isConfirmed(uint256 transactionId) external returns (bool);

    /*
     * Web3 call functions
     */
    function getConfirmationCount(uint256 transactionId) external returns (uint256 count);

    function getTransactionCount(bool pending, bool executed) external returns (uint256 count);

    function getOwners() external returns (address[] memory);

    function getConfirmations(uint256 transactionId) external returns (address[] memory _confirmations);

    function getTransactionIds(
        uint256 from,
        uint256 to,
        bool pending,
        bool executed
    ) external returns (uint256[] memory _transactionIds);
}
