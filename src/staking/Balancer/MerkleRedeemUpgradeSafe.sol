// source: https://github.com/balancer-labs/erc20-redeemable/blob/master/merkle/contracts/MerkleRedeem.sol
// changes:
// 1. add license and update solidity version to 0.6.9
// 2. make it upgradeable
// 3. add virtual modifier in claim functions

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { MerkleProof } from "@openzeppelin/contracts-ethereum-package/contracts/cryptography/MerkleProof.sol";
import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { PerpFiOwnableUpgrade } from "../../utils/PerpFiOwnableUpgrade.sol";

contract MerkleRedeemUpgradeSafe is PerpFiOwnableUpgrade {
    event Claimed(address _claimant, uint256 _balance);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//
    // Recorded weeks
    mapping(uint256 => bytes32) public weekMerkleRoots;
    mapping(uint256 => mapping(address => bool)) public claimed;

    IERC20 public token;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //

    function __MerkleRedeem_init(IERC20 _token) internal initializer {
        __Ownable_init();
        __MerkleRedeem_init_unchained(_token);
    }

    function __MerkleRedeem_init_unchained(IERC20 _token) internal initializer {
        token = _token;
    }

    function disburse(address _liquidityProvider, uint256 _balance) private {
        if (_balance > 0) {
            emit Claimed(_liquidityProvider, _balance);
            require(token.transfer(_liquidityProvider, _balance), "ERR_TRANSFER_FAILED");
        }
    }

    function claimWeek(
        address _liquidityProvider,
        uint256 _week,
        uint256 _claimedBalance,
        bytes32[] memory _merkleProof
    ) public virtual {
        require(!claimed[_week][_liquidityProvider], "Claimed already");
        require(verifyClaim(_liquidityProvider, _week, _claimedBalance, _merkleProof), "Incorrect merkle proof");

        claimed[_week][_liquidityProvider] = true;
        disburse(_liquidityProvider, _claimedBalance);
    }

    struct Claim {
        uint256 week;
        uint256 balance;
        bytes32[] merkleProof;
    }

    function claimWeeks(address _liquidityProvider, Claim[] memory claims) public virtual {
        uint256 totalBalance = 0;
        Claim memory claim;
        for (uint256 i = 0; i < claims.length; i++) {
            claim = claims[i];

            require(!claimed[claim.week][_liquidityProvider], "Claimed already");
            require(
                verifyClaim(_liquidityProvider, claim.week, claim.balance, claim.merkleProof),
                "Incorrect merkle proof"
            );

            totalBalance += claim.balance;
            claimed[claim.week][_liquidityProvider] = true;
        }
        disburse(_liquidityProvider, totalBalance);
    }

    function claimStatus(
        address _liquidityProvider,
        uint256 _begin,
        uint256 _end
    ) external view returns (bool[] memory) {
        uint256 size = 1 + _end - _begin;
        bool[] memory arr = new bool[](size);
        for (uint256 i = 0; i < size; i++) {
            arr[i] = claimed[_begin + i][_liquidityProvider];
        }
        return arr;
    }

    function merkleRoots(uint256 _begin, uint256 _end) external view returns (bytes32[] memory) {
        uint256 size = 1 + _end - _begin;
        bytes32[] memory arr = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            arr[i] = weekMerkleRoots[_begin + i];
        }
        return arr;
    }

    function verifyClaim(
        address _liquidityProvider,
        uint256 _week,
        uint256 _claimedBalance,
        bytes32[] memory _merkleProof
    ) public view virtual returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(_liquidityProvider, _claimedBalance));
        return MerkleProof.verify(_merkleProof, weekMerkleRoots[_week], leaf);
    }

    function seedAllocations(
        uint256 _week,
        bytes32 _merkleRoot,
        uint256 _totalAllocation
    ) public virtual {
        require(weekMerkleRoots[_week] == bytes32(0), "cannot rewrite merkle root");
        weekMerkleRoots[_week] = _merkleRoot;

        require(token.transferFrom(msg.sender, address(this), _totalAllocation), "ERR_TRANSFER_FAILED");
    }
}
