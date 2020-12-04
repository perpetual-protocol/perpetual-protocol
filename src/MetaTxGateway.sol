// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;

import { SafeMath } from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { LowLevelErrorMessage } from "./utils/LowLevelErrorMessage.sol";

// this is functionally identical to https://github.com/bcnmy/metatx-standard/blob/master/src/contracts/EIP712MetaTransaction.sol
// except it implements openzeppelin Initializable
contract MetaTxGateway is PerpFiOwnableUpgrade, LowLevelErrorMessage {
    using SafeMath for uint256;

    //
    // EVENTS
    //
    event MetaTransactionExecuted(address from, address to, address payable relayerAddress, bytes functionSignature);

    //
    // Struct and Enum
    //
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    /*
     * Meta transaction structure.
     * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
     * He should call the desired function directly in that case.
     */
    struct MetaTransaction {
        uint256 nonce;
        address from;
        address to;
        bytes functionSignature;
    }

    //
    // Constant
    //
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(
        bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    );

    bytes32 private constant META_TRANSACTION_TYPEHASH = keccak256(
        bytes("MetaTransaction(uint256 nonce,address from,address to,bytes functionSignature)")
    );

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//

    bytes32 internal domainSeperatorL1;
    bytes32 internal domainSeperatorL2;
    mapping(address => uint256) private nonces;

    // whitelist of contracts this gateway can execute
    mapping(address => bool) private whitelistMap;

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(
        string memory _name,
        string memory _version,
        uint256 _chainIdL1
    ) public initializer {
        __Ownable_init();

        domainSeperatorL1 = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(_name)),
                keccak256(bytes(_version)),
                _chainIdL1,
                address(this)
            )
        );

        domainSeperatorL2 = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(_name)),
                keccak256(bytes(_version)),
                getChainID(),
                address(this)
            )
        );
    }

    /**
     * @notice add an address to the whitelist. Only contracts in the whitelist can be executed by this gateway.
     *         This prevents the gateway from being abused to execute arbitrary meta txs
     * @dev only owner can call
     * @param _addr an address
     */
    function addToWhitelists(address _addr) external onlyOwner {
        whitelistMap[_addr] = true;
    }

    function removeFromWhitelists(address _addr) external onlyOwner {
        delete whitelistMap[_addr];
    }

    function executeMetaTransaction(
        address from,
        address to,
        bytes calldata functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external returns (bytes memory) {
        require(isInWhitelists(to), "!whitelisted");

        MetaTransaction memory metaTx = MetaTransaction({
            nonce: nonces[from],
            from: from,
            to: to,
            functionSignature: functionSignature
        });

        require(
            verify(from, domainSeperatorL1, metaTx, sigR, sigS, sigV) ||
                verify(from, domainSeperatorL2, metaTx, sigR, sigS, sigV),
            "Meta tx Signer and signature do not match"
        );

        nonces[from] = nonces[from].add(1);
        // Append userAddress at the end to extract it from calling context
        // solhint-disable avoid-low-level-calls
        (bool success, bytes memory returnData) = address(to).call(abi.encodePacked(functionSignature, from));
        require(success, _getRevertMessage(returnData));
        emit MetaTransactionExecuted(from, to, msg.sender, functionSignature);
        return returnData;
    }

    //
    // VIEW FUNCTIONS
    //

    function getNonce(address user) external view returns (uint256 nonce) {
        nonce = nonces[user];
    }

    //
    // INTERNAL VIEW FUNCTIONS
    //

    function isInWhitelists(address _addr) public view returns (bool) {
        return whitelistMap[_addr];
    }

    function getChainID() internal pure returns (uint256 id) {
        assembly {
            id := chainid()
        }
    }

    /**
     * Accept message hash and returns hash message in EIP712 compatible form
     * So that it can be used to recover signer from signature signed using EIP712 formatted data
     * https://eips.ethereum.org/EIPS/eip-712
     * "\\x19" makes the encoding deterministic
     * "\\x01" is the version byte to make it compatible to EIP-191
     */
    function toTypedMessageHash(bytes32 domainSeperator, bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeperator, messageHash));
    }

    function hashMetaTransaction(MetaTransaction memory metaTx) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    META_TRANSACTION_TYPEHASH,
                    metaTx.nonce,
                    metaTx.from,
                    metaTx.to,
                    keccak256(metaTx.functionSignature)
                )
            );
    }

    function verify(
        address user,
        bytes32 domainSeperator,
        MetaTransaction memory metaTx,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) internal pure returns (bool) {
        address signer = ecrecover(toTypedMessageHash(domainSeperator, hashMetaTransaction(metaTx)), sigV, sigR, sigS);
        require(signer != address(0), "invalid signature");
        return signer == user;
    }
}
