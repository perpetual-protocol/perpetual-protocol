// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { SafeMath } from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import { IERC20WithCheckpointing } from "./aragonone/IERC20WithCheckpointing.sol";
import { Checkpointing } from "./aragonone/Checkpointing.sol";
import { CheckpointingHelpers } from "./aragonone/CheckpointingHelpers.sol";
import { ERC20ViewOnlyUpgradeSafe } from "../utils/ERC20ViewOnlyUpgradeSafe.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { BlockContext } from "../utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { IFeeRewardPool } from "../interface/IFeeRewardPool.sol";

contract StakedPerpToken is
    IERC20WithCheckpointing,
    ERC20ViewOnlyUpgradeSafe,
    DecimalERC20,
    PerpFiOwnableUpgrade,
    BlockContext
{
    using Checkpointing for Checkpointing.History;
    using CheckpointingHelpers for uint256;
    using SafeMath for uint256;

    //
    // CONSTANT
    //
    uint256 public constant COOLDOWN_PERIOD = 120960; // a week, (7 * 24 * 60 * 60) / 5 ~= 120,960 blocks

    //
    // EVENTS
    //
    event Staked(address staker, uint256 amount);
    event Unstaked(address staker, uint256 amount);
    event Withdrawn(address staker, uint256 amount);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // Checkpointing total supply of the deposited token
    Checkpointing.History internal totalSupplyHistory;

    // Checkpointing balances of the deposited token by block number
    mapping(address => Checkpointing.History) internal balancesHistory;

    // staker => the time staker can withdraw PERP
    mapping(address => uint256) public stakerCooldown;

    // staker => PERP staker can withdraw
    mapping(address => Decimal.decimal) public stakerWithdrawPendingBalance;

    IERC20 public perpToken;
    IFeeRewardPool public rewardPool;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(IERC20 _perpToken, IFeeRewardPool _rewardPool) public initializer {
        require(address(_perpToken) != address(0) && address(_rewardPool) != address(0), "Invalid input.");
        __ERC20ViewOnly_init("Staked Perpetual", "sPERP");
        __Ownable_init();
        perpToken = _perpToken;
        rewardPool = _rewardPool;
    }

    function stake(Decimal.decimal calldata _amount) external {
        requireNonZeroAmount(_amount);
        address msgSender = _msgSender();

        // copy calldata amount to memory
        Decimal.decimal memory amount = _amount;

        // stake after unstake is allowed, and the states mutated by unstake() will being undo
        if (stakerWithdrawPendingBalance[msgSender].toUint() != 0) {
            amount = amount.addD(stakerWithdrawPendingBalance[msgSender]);
            delete stakerWithdrawPendingBalance[msgSender];
            delete stakerCooldown[msgSender];
        }

        uint256 blockNumber = _blockNumber();
        Decimal.decimal memory balance = Decimal.decimal(balancesHistory[msgSender].latestValue());
        Decimal.decimal memory totalSupply = Decimal.decimal(totalSupplyHistory.latestValue());
        Decimal.decimal memory newBalance = balance.addD(amount);

        // if staking after unstaking, the amount to be transferred does not need to be updated
        _transferFrom(perpToken, msgSender, address(this), _amount);
        mint(msgSender, amount);

        addPersonalBalanceCheckPoint(msgSender, blockNumber, newBalance);
        addTotalSupplyCheckPoint(blockNumber, totalSupply.addD(amount));

        // Have to update balance first
        rewardPool.notifyStake(msgSender);

        emit Staked(msgSender, _amount.toUint());
    }

    // this function mutates stakerWithdrawPendingBalance, stakerCooldown, addTotalSupplyCheckPoint,
    // addPersonalBalanceCheckPoint, burn
    function unstake() external {
        address msgSender = _msgSender();
        require(stakerWithdrawPendingBalance[msgSender].toUint() == 0, "Need to withdraw first");

        Decimal.decimal memory balance = Decimal.decimal(balancesHistory[msgSender].latestValue());
        requireNonZeroAmount(balance);

        burn(msgSender, balance);

        uint256 blockNumber = _blockNumber();
        Decimal.decimal memory totalSupply = Decimal.decimal(totalSupplyHistory.latestValue());
        addPersonalBalanceCheckPoint(msgSender, blockNumber, Decimal.zero());
        addTotalSupplyCheckPoint(blockNumber, totalSupply.subD(balance));
        stakerCooldown[msgSender] = blockNumber.add(COOLDOWN_PERIOD);
        stakerWithdrawPendingBalance[msgSender] = balance;

        // Have to update balance first
        rewardPool.notifyStake(msgSender);

        emit Unstaked(msgSender, balance.toUint());
    }

    function withdraw() external {
        address msgSender = _msgSender();
        Decimal.decimal memory balance = stakerWithdrawPendingBalance[msgSender];
        requireNonZeroAmount(balance);
        // there won't be a case that cooldown == 0 && balance == 0
        require(_blockNumber() >= stakerCooldown[msgSender], "Still in cooldown");

        delete stakerWithdrawPendingBalance[msgSender];
        delete stakerCooldown[msgSender];
        _transfer(perpToken, msgSender, balance);

        emit Withdrawn(msgSender, balance.toUint());
    }

    //
    // override: ERC20UpgradeSafe, not allowed to transfer/transferFrom/approve in StakedPerpToken
    //
    function transfer(address, uint256) public override returns (bool) {
        revert("transfer() is not supported");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public override returns (bool) {
        revert("transferFrom() is not supported");
    }

    function approve(address, uint256) public override returns (bool) {
        revert("approve() is not supported");
    }

    //
    // VIEW FUNCTIONS
    //

    function latestBalance(address _owner) external view returns (uint256) {
        return balancesHistory[_owner].latestValue();
    }

    function latestTotalSupply() external view returns (uint256) {
        return totalSupplyHistory.latestValue();
    }

    //
    // override: IERC20WithCheckpointing
    //
    function balanceOfAt(address _owner, uint256 _blockNumber) external view override returns (uint256) {
        return _balanceOfAt(_owner, _blockNumber).toUint();
    }

    function totalSupplyAt(uint256 _blockNumber) external view override returns (uint256) {
        return _totalSupplyAt(_blockNumber).toUint();
    }

    //
    // INTERNAL FUNCTIONS
    //

    function mint(address _staker, Decimal.decimal memory _amount) private {
        _mint(_staker, _amount.toUint());
    }

    function burn(address _staker, Decimal.decimal memory _amount) private {
        _burn(_staker, _amount.toUint());
    }

    function addTotalSupplyCheckPoint(uint256 _blockNumber, Decimal.decimal memory _amount) internal {
        totalSupplyHistory.addCheckpoint(_blockNumber.toUint64Time(), _amount.toUint().toUint192Value());
    }

    function addPersonalBalanceCheckPoint(
        address _staker,
        uint256 _blockNumber,
        Decimal.decimal memory _amount
    ) internal {
        balancesHistory[_staker].addCheckpoint(_blockNumber.toUint64Time(), _amount.toUint().toUint192Value());
    }

    function _balanceOfAt(address _owner, uint256 _blockNumber) internal view returns (Decimal.decimal memory) {
        return Decimal.decimal(balancesHistory[_owner].getValueAt(_blockNumber.toUint64Time()));
    }

    function _totalSupplyAt(uint256 _blockNumber) internal view returns (Decimal.decimal memory) {
        return Decimal.decimal(totalSupplyHistory.getValueAt(_blockNumber.toUint64Time()));
    }

    function requireNonZeroAmount(Decimal.decimal memory _amount) private pure {
        require(_amount.toUint() > 0, "Amount is 0");
    }
}
