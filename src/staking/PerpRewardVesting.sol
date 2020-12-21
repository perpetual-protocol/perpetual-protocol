// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import { MerkleRedeem } from "./Balancer/MerkleRedeem.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { BlockContext } from "../utils/BlockContext.sol";

contract PerpRewardVesting is MerkleRedeem, BlockContext {
    using Decimal for Decimal.decimal;
    using SafeMath for uint256;

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//
    // {weekMerkleRootsIndex: timestamp}
    mapping(uint256 => uint256) public merkleRootTimestampMap;
    mapping(uint256 => uint256) public vestingPeriodMap;

    // array of weekMerkleRootsIndex
    uint256[] public merkleRootIndexes;

    // default is 12 weeks = 7257600 seconds
    uint256 public defaultVestingPeriod;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variable, ables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    function initialize(IERC20 _token, uint256 _defaultVestingPeriod) external {
        require(address(_token) != address(0) && _defaultVestingPeriod != 0, "Invalid input");
        __Ownable_init();
        token = _token;
        defaultVestingPeriod = _defaultVestingPeriod;
    }

    function claimWeeks(address _account, Claim[] memory _claims) public virtual override {
        for (uint256 i; i < _claims.length; i++) {
            claimWeek(_account, _claims[i].week, _claims[i].balance, _claims[i].merkleProof);
        }
    }

    function claimWeek(
        address _account,
        uint256 _week,
        uint256 _claimedBalance,
        bytes32[] memory _merkleProof
    ) public virtual override {
        //
        //         claimableTimestamp      now
        //                  +----------------+
        //                  | vesting period |
        //  ---------+------+---+------------+--
        //           |          |
        //           | merkleRootTimestampMap[weeks+1] --> non-claimable
        //           |
        // merkleRootTimestampMap[weeks] --> claimable
        //
        uint256 claimableTimestamp = _blockTimestamp().sub(vestingPeriodMap[_week]);
        require(claimableTimestamp >= merkleRootTimestampMap[_week], "Claiming is not yet available");
        super.claimWeek(_account, _week, _claimedBalance, _merkleProof);
    }

    function seedAllocations(
        uint256 _week,
        bytes32 _merkleRoot,
        uint256 _totalAllocation
    ) public virtual override onlyOwner {
        super.seedAllocations(_week, _merkleRoot, _totalAllocation);
        merkleRootTimestampMap[_week] = _blockTimestamp();
        merkleRootIndexes.push(_week);
        vestingPeriodMap[_week] = defaultVestingPeriod;
    }

    //
    // INTERNAL
    //

    function getLengthOfMerkleRoots() external view returns (uint256) {
        return merkleRootIndexes.length;
    }
}
