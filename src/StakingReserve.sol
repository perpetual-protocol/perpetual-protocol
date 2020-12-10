// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import {
    ReentrancyGuardUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";
import { SignedDecimal, MixedDecimal } from "./utils/MixedDecimal.sol";
import { RewardsDistributionRecipient } from "./RewardsDistributionRecipient.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { SupplySchedule } from "./SupplySchedule.sol";
import { IMultiTokenRewardRecipient } from "./interface/IMultiTokenRewardRecipient.sol";

contract StakingReserve is
    RewardsDistributionRecipient,
    IMultiTokenRewardRecipient,
    DecimalERC20,
    BlockContext,
    ReentrancyGuardUpgradeSafe
{
    using SafeMath for uint256;
    using Decimal for Decimal.decimal;
    using SignedDecimal for SignedDecimal.signedDecimal;
    using MixedDecimal for SignedDecimal.signedDecimal;

    //
    // EVENTS
    //
    event RewardWithdrawn(address staker, uint256 amount);
    event FeeInEpoch(address token, uint256 fee, uint256 epoch);

    //
    // STRUCT
    //

    // TODO can improve if change to cumulative version
    struct EpochReward {
        Decimal.decimal perpReward;
        // key by Fee ERC20 token address
        mapping(address => Decimal.decimal) feeMap;
    }

    struct StakeBalance {
        bool exist;
        // denominated in perpToken
        Decimal.decimal totalBalance;
        uint256 rewardEpochCursor;
        uint256 feeEpochCursor;
        // key by epochReward index (the starting epoch index when staker stake take effect)
        mapping(uint256 => LockedBalance) lockedBalanceMap;
    }

    struct LockedBalance {
        bool exist;
        // locked staking amount
        Decimal.decimal locked;
        // timeWeightedLocked = locked * (how long has it been until endOfThisEpoch / epochPeriod)
        Decimal.decimal timeWeightedLocked;
    }

    struct FeeBalance {
        address token;
        Decimal.decimal balance;
    }

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//
    SignedDecimal.signedDecimal private totalPendingStakeBalance;

    // the unit of vestingPeriod is epoch, by default 52 epochs equals to 1 year
    uint256 public vestingPeriod;

    // key by staker address
    mapping(address => StakeBalance) public stakeBalanceMap;

    // key by epoch index
    mapping(uint256 => Decimal.decimal) private totalEffectiveStakeMap;

    EpochReward[] public epochRewardHistory;

    address[] public stakers;

    address public perpToken;
    SupplySchedule private supplySchedule;

    /* @dev
     * record all the fee tokens (not remove)
     */
    IERC20[] public feeTokens;
    // key by Fee ERC20 token address
    mapping(IERC20 => Decimal.decimal) public feeMap;

    // address who can call `notifyTokenAmount`, it's `clearingHouse` for now.
    address public feeNotifier;

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
        address _perpToken,
        SupplySchedule _supplySchedule,
        address _feeNotifier,
        uint256 _vestingPeriod
    ) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        perpToken = _perpToken;
        supplySchedule = _supplySchedule;
        feeNotifier = _feeNotifier;
        vestingPeriod = _vestingPeriod;
    }

    function setVestingPeriod(uint256 _vestingPeriod) external onlyOwner {
        vestingPeriod = _vestingPeriod;
    }

    /**
     * @dev staker can increase staking any time,
     */
    function stake(Decimal.decimal memory _amount) public {
        require(_amount.toUint() > 0, "Input amount is zero");
        address sender = _msgSender();
        require(_amount.toUint() <= getUnlockedBalance(sender).toUint(), "Stake more than all balance");
        require(supplySchedule.isStarted(), "PERP reward has not started");

        uint256 epochDuration = supplySchedule.mintDuration();
        uint256 afterNextEpochIndex = nextEpochIndex().add(1);
        uint256 nextEndEpochTimestamp = supplySchedule.nextMintTime();

        // ignore this epoch if keeper didn't endEpoch in time
        Decimal.decimal memory timeWeightedLocked;
        if (nextEndEpochTimestamp > _blockTimestamp()) {
            // calculate timeWeightedLocked based on additional staking amount and the remain time during this epoch
            timeWeightedLocked = _amount.mulScalar(nextEndEpochTimestamp.sub(_blockTimestamp())).divScalar(
                epochDuration
            );

            // update stakerBalance for next epoch
            increaseStake(sender, nextEpochIndex(), _amount, timeWeightedLocked);
        }

        // update stakerBalance for next + 1 epoch
        StakeBalance storage balance = stakeBalanceMap[sender];
        if (balance.lockedBalanceMap[afterNextEpochIndex].exist) {
            increaseStake(sender, afterNextEpochIndex, _amount, _amount);
        } else {
            LockedBalance memory currentBalance = balance.lockedBalanceMap[nextEpochIndex()];
            balance.lockedBalanceMap[afterNextEpochIndex] = LockedBalance(
                true,
                currentBalance.locked,
                currentBalance.locked
            );
        }

        // update global stake balance states
        totalEffectiveStakeMap[nextEpochIndex()] = totalEffectiveStakeMap[nextEpochIndex()].addD(timeWeightedLocked);
        totalPendingStakeBalance = totalPendingStakeBalance.addD(_amount).subD(timeWeightedLocked);
    }

    /**
     * @dev staker can decrease staking from stakeBalanceForNextEpoch
     */
    function unstake(Decimal.decimal calldata _amount) external {
        require(_amount.toUint() > 0, "Input amount is zero");
        address sender = _msgSender();
        require(_amount.toUint() <= getUnstakableBalance(sender).toUint(), "Unstake more than locked balance");

        // decrease stake balance for after next epoch
        uint256 afterNextEpochIndex = nextEpochIndex().add(1);
        LockedBalance memory afterNextLockedBalance = getLockedBalance(sender, afterNextEpochIndex);
        stakeBalanceMap[sender].lockedBalanceMap[afterNextEpochIndex] = LockedBalance(
            true,
            afterNextLockedBalance.locked.subD(_amount),
            afterNextLockedBalance.timeWeightedLocked.subD(_amount)
        );

        // update global stake balance states
        totalPendingStakeBalance = totalPendingStakeBalance.subD(_amount);
    }

    function depositAndStake(Decimal.decimal calldata _amount) external nonReentrant() {
        deposit(_msgSender(), _amount);
        stake(_amount);
    }

    function withdraw(Decimal.decimal calldata _amount) external nonReentrant() {
        require(_amount.toUint() != 0, "Input amount is zero");
        address sender = _msgSender();
        require(_amount.toUint() <= getUnlockedBalance(sender).toUint(), "Not enough balance");
        stakeBalanceMap[sender].totalBalance = stakeBalanceMap[sender].totalBalance.subD(_amount);
        _transfer(IERC20(perpToken), sender, _amount);
    }

    /**
     * @dev add epoch reward, update totalEffectiveStakeMap
     */
    function notifyRewardAmount(Decimal.decimal calldata _amount) external override onlyRewardsDistribution {
        // record reward to epochRewardHistory
        Decimal.decimal memory totalBalanceBeforeEndEpoch = getTotalBalance();
        epochRewardHistory.push(EpochReward(_amount));

        // Note this is initialized AFTER a new entry is pushed to epochRewardHistory, hence the minus 1
        uint256 currentEpochIndex = nextEpochIndex().sub(1);
        for (uint256 i; i < feeTokens.length; i++) {
            IERC20 token = feeTokens[i];
            emit FeeInEpoch(address(token), feeMap[token].toUint(), currentEpochIndex);
            epochRewardHistory[currentEpochIndex].feeMap[address(token)] = feeMap[token];
            feeMap[token] = Decimal.zero();
        }

        // update totalEffectiveStakeMap for coming epoch
        SignedDecimal.signedDecimal memory updatedTotalEffectiveStakeBalance = totalPendingStakeBalance.addD(
            totalBalanceBeforeEndEpoch
        );
        require(updatedTotalEffectiveStakeBalance.toInt() >= 0, "Unstake more than locked balance");
        totalEffectiveStakeMap[(nextEpochIndex())] = updatedTotalEffectiveStakeBalance.abs();
        totalPendingStakeBalance = SignedDecimal.zero();
    }

    function notifyTokenAmount(IERC20 _token, Decimal.decimal calldata _amount) external override {
        require(feeNotifier == _msgSender(), "!feeNotifier");
        require(_amount.toUint() > 0, "amount can't be 0");

        feeMap[_token] = feeMap[_token].addD(_amount);
        if (!isExistedFeeToken(_token)) {
            feeTokens.push(_token);
        }
    }

    /*
     * claim all fees and vested reward at once
     * update lastUpdatedEffectiveStake
     */
    function claimFeesAndVestedReward() external nonReentrant() {
        // calculate fee and reward
        address staker = _msgSender();
        Decimal.decimal memory reward = getVestedReward(staker);
        FeeBalance[] memory fees = getFeeRevenue(staker);
        bool hasFees = fees.length > 0;
        bool hasReward = reward.toUint() > 0;
        require(hasReward || hasFees, "no vested reward or fee");

        // transfer fee reward
        stakeBalanceMap[staker].feeEpochCursor = epochRewardHistory.length;
        for (uint256 i = 0; i < fees.length; i++) {
            if (fees[i].balance.toUint() != 0) {
                _transfer(IERC20(fees[i].token), staker, fees[i].balance);
            }
        }

        // transfer perp reward
        if (hasReward && epochRewardHistory.length >= vestingPeriod) {
            // solhint-disable reentrancy
            stakeBalanceMap[staker].rewardEpochCursor = epochRewardHistory.length.sub(vestingPeriod);
            _transfer(IERC20(perpToken), staker, reward);
            emit RewardWithdrawn(staker, reward.toUint());
        }
    }

    function setFeeNotifier(address _notifier) external onlyOwner {
        feeNotifier = _notifier;
    }

    //
    // VIEW FUNCTIONS
    //

    function isExistedFeeToken(IERC20 _token) public view returns (bool) {
        for (uint256 i = 0; i < feeTokens.length; i++) {
            if (feeTokens[i] == _token) {
                return true;
            }
        }
        return false;
    }

    function nextEpochIndex() public view returns (uint256) {
        return epochRewardHistory.length;
    }

    /**
     * everyone can query total balance to check current collateralization ratio.
     * TotalBalance of time weighted locked PERP for coming epoch
     */
    function getTotalBalance() public view returns (Decimal.decimal memory) {
        return totalEffectiveStakeMap[nextEpochIndex()];
    }

    function getTotalEffectiveStake(uint256 _epochIndex) public view returns (Decimal.decimal memory) {
        return totalEffectiveStakeMap[_epochIndex];
    }

    function getFeeOfEpoch(uint256 _epoch, address _token) public view returns (Decimal.decimal memory) {
        return epochRewardHistory[_epoch].feeMap[_token];
    }

    function getFeeRevenue(address _staker) public view returns (FeeBalance[] memory feeBalance) {
        StakeBalance storage balance = stakeBalanceMap[_staker];
        if (balance.feeEpochCursor == nextEpochIndex()) {
            return feeBalance;
        }

        uint256 numberOfTokens = feeTokens.length;
        feeBalance = new FeeBalance[](numberOfTokens);
        Decimal.decimal memory latestLockedStake;
        // TODO enhancement, we can loop feeTokens first to save more gas if some feeToken was not used
        for (uint256 i = balance.feeEpochCursor; i < nextEpochIndex(); i++) {
            if (balance.lockedBalanceMap[i].timeWeightedLocked.toUint() != 0) {
                latestLockedStake = balance.lockedBalanceMap[i].timeWeightedLocked;
            }
            if (latestLockedStake.toUint() == 0) {
                continue;
            }
            Decimal.decimal memory effectiveStakePercentage = latestLockedStake.divD(totalEffectiveStakeMap[i]);

            for (uint256 j = 0; j < numberOfTokens; j++) {
                IERC20 token = feeTokens[j];
                Decimal.decimal memory feeInThisEpoch = getFeeOfEpoch(i, address(token));
                if (feeInThisEpoch.toUint() == 0) {
                    continue;
                }
                feeBalance[j].balance = feeBalance[j].balance.addD(feeInThisEpoch.mulD(effectiveStakePercentage));
                feeBalance[j].token = address(token);
            }
        }
    }

    function getVestedReward(address _staker) public view returns (Decimal.decimal memory reward) {
        if (nextEpochIndex() < vestingPeriod) {
            return Decimal.zero();
        }

        // Note that rewardableEpochEnd is exclusive. The last rewardable epoch index = rewardableEpochEnd - 1
        uint256 rewardableEpochEnd = nextEpochIndex().sub(vestingPeriod);
        StakeBalance storage balance = stakeBalanceMap[_staker];
        if (balance.rewardEpochCursor > rewardableEpochEnd) {
            return Decimal.zero();
        }

        Decimal.decimal memory latestLockedStake;
        for (uint256 i = balance.rewardEpochCursor; i < rewardableEpochEnd; i++) {
            if (balance.lockedBalanceMap[i].timeWeightedLocked.toUint() != 0) {
                latestLockedStake = balance.lockedBalanceMap[i].timeWeightedLocked;
            }
            if (latestLockedStake.toUint() == 0) {
                continue;
            }
            Decimal.decimal memory rewardInThisEpoch = epochRewardHistory[i].perpReward.mulD(latestLockedStake).divD(
                totalEffectiveStakeMap[i]
            );
            reward = reward.addD(rewardInThisEpoch);
        }
    }

    function getUnlockedBalance(address _staker) public view returns (Decimal.decimal memory) {
        Decimal.decimal memory lockedForNextEpoch = getLockedBalance(_staker, nextEpochIndex()).locked;
        return stakeBalanceMap[_staker].totalBalance.subD(lockedForNextEpoch);
    }

    // unstakable = lockedBalance@NextEpoch+1
    function getUnstakableBalance(address _staker) public view returns (Decimal.decimal memory) {
        return getLockedBalance(_staker, nextEpochIndex().add(1)).locked;
    }

    // only store locked balance when there's changed, so if the target lockedBalance is not exist,
    // use the lockedBalance from the closest previous epoch
    function getLockedBalance(address _staker, uint256 _epochIndex) public view returns (LockedBalance memory) {
        while (_epochIndex >= 0) {
            LockedBalance memory lockedBalance = stakeBalanceMap[_staker].lockedBalanceMap[_epochIndex];
            if (lockedBalance.exist) {
                return lockedBalance;
            }
            if (_epochIndex == 0) {
                break;
            }
            _epochIndex -= 1;
        }
        return LockedBalance(false, Decimal.zero(), Decimal.zero());
    }

    function getEpochRewardHistoryLength() external view returns (uint256) {
        return epochRewardHistory.length;
    }

    function getRewardEpochCursor(address _staker) public view returns (uint256) {
        return stakeBalanceMap[_staker].rewardEpochCursor;
    }

    function getFeeEpochCursor(address _staker) public view returns (uint256) {
        return stakeBalanceMap[_staker].feeEpochCursor;
    }

    //
    // Private
    //

    function increaseStake(
        address _sender,
        uint256 _epochIndex,
        Decimal.decimal memory _locked,
        Decimal.decimal memory _timeWeightedLocked
    ) private {
        LockedBalance memory lockedBalance = getLockedBalance(_sender, _epochIndex);
        stakeBalanceMap[_sender].lockedBalanceMap[_epochIndex] = LockedBalance(
            true,
            lockedBalance.locked.addD(_locked),
            lockedBalance.timeWeightedLocked.addD(_timeWeightedLocked)
        );
    }

    function deposit(address _sender, Decimal.decimal memory _amount) private {
        require(_amount.toUint() != 0, "Input amount is zero");
        StakeBalance storage balance = stakeBalanceMap[_sender];
        if (!balance.exist) {
            stakers.push(_sender);
            balance.exist = true;
            // set rewardEpochCursor for the first staking
            balance.rewardEpochCursor = nextEpochIndex();
        }
        balance.totalBalance = balance.totalBalance.addD(_amount);
        _transferFrom(IERC20(perpToken), _sender, address(this), _amount);
    }
}
