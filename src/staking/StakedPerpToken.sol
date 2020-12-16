// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import { ERC20UpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import { SafeMath } from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import { IERC20WithCheckpointing } from "./aragonone/IERC20WithCheckpointing.sol";
import { Checkpointing } from "./aragonone/Checkpointing.sol";
import { CheckpointingHelpers } from "./aragonone/CheckpointingHelpers.sol";
import { Decimal } from "../utils/Decimal.sol";
import { DecimalERC20 } from "../utils/DecimalERC20.sol";
import { BlockContext } from "../utils/BlockContext.sol";
import { PerpFiOwnableUpgrade } from "../utils/PerpFiOwnableUpgrade.sol";
import { IRewardPool } from "../interface/IRewardPool.sol";

contract StakedPerpToken is
    IERC20WithCheckpointing,
    PerpFiOwnableUpgrade,
    DecimalERC20,
    ERC20UpgradeSafe,
    BlockContext
{
    using Checkpointing for Checkpointing.History;
    using CheckpointingHelpers for uint256;
    using SafeMath for uint256;

    //
    // CONSTANT
    //
    uint256 public constant COOLDOWN_PERIOD = 1 weeks;

    //
    // EVENTS
    //
    event Stake(address staker, uint256 amount, uint256 blockNumber);
    event Unstake(address staker, uint256 amount, uint256 blockNumber);
    event Withdraw(address staker, uint256 amount, uint256 blockNumber);

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    // Checkpointed balances of the deposited token by block number
    mapping(address => Checkpointing.History) internal balancesHistory;

    // Checkpointed total supply of the deposited token
    Checkpointing.History internal totalSupplyHistory;

    // staker => the time staker can withdraw PERP
    mapping(address => uint256) public stakerCooldown;

    // staker => PERP staker can withdraw
    mapping(address => Decimal.decimal) public stakerWithdrawPendingBalance;

    IERC20 public perpToken;
    IRewardPool public rewardPool;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //
    function initialize(IERC20 _perpToken, IRewardPool _rewardPool) public {
        require(address(_perpToken) != address(0) && address(_rewardPool) != address(0), "Invalid input.");
        __Ownable_init();
        perpToken = _perpToken;
        rewardPool = _rewardPool;
    }

    function stake(Decimal.decimal calldata _amount) external {
        requireNonZeroAmount(_amount);

        address msgSender = _msgSender();
        uint256 amount = _amount.toUint();
        requireNotInCoolDown(msgSender);
        _transferFrom(perpToken, msgSender, address(this), _amount);
        _mint(msgSender, amount);

        uint64 blockNumber = _blockNumber().toUint64Time();
        uint256 balance = balancesHistory[msgSender].latestValue();
        uint256 totalSupply = totalSupplyHistory.latestValue();
        uint256 newBalance = balance.add(amount);
        balancesHistory[msgSender].addCheckpoint(blockNumber, newBalance.toUint192Value());
        totalSupplyHistory.addCheckpoint(blockNumber, totalSupply.add(amount).toUint192Value());

        rewardPool.notifyStake(msgSender, Decimal.decimal(newBalance));

        emit Stake(msgSender, amount, uint256(blockNumber));
    }

    function unstake() external {
        address msgSender = _msgSender();
        uint256 balance = balancesHistory[msgSender].latestValue();
        requireNotInCoolDown(msgSender);
        requireNonZeroAmount(Decimal.decimal(balance));
        _burn(msgSender, balance);

        uint256 blockNumber = _blockNumber();
        uint256 totalSupply = totalSupplyHistory.latestValue();
        balancesHistory[msgSender].addCheckpoint(blockNumber.toUint64Time(), uint192(0));
        totalSupplyHistory.addCheckpoint(blockNumber.toUint64Time(), totalSupply.sub(balance).toUint192Value());
        stakerCooldown[msgSender] = blockNumber.add(COOLDOWN_PERIOD);
        stakerWithdrawPendingBalance[msgSender] = Decimal.decimal(balance);

        rewardPool.notifyStake(msgSender, Decimal.zero());

        emit Unstake(msgSender, balance, blockNumber);
    }

    function withdraw() external {
        address msgSender = _msgSender();
        uint256 blockNumber = _blockNumber();
        Decimal.decimal memory balance = stakerWithdrawPendingBalance[msgSender];
        require(stakerCooldown[msgSender] > blockNumber);
        requireNonZeroAmount(balance);

        stakerWithdrawPendingBalance[msgSender] = Decimal.zero();
        stakerCooldown[msgSender] = 0;
        _transfer(perpToken, msgSender, balance);

        emit Withdraw(msgSender, balance.toUint(), blockNumber);
    }

    function latestBalance(address _owner) external view returns (Decimal.decimal memory) {
        return _balanceOfAt(_owner, _blockNumber());
    }

    function latestTotalSupply() external view returns (Decimal.decimal memory) {
        return _totalSupplyAt(_blockNumber());
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
    // override: ERC20UpgradeSafe
    //
    function transfer(address, uint256) public override returns (bool) {
        revert("transfer() is not supported.");
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public override returns (bool) {
        revert("transferFrom() is not supported.");
    }

    function approve(address, uint256) public override returns (bool) {
        revert("approve() is not supported.");
    }

    //
    // INTERNAL FUNCTIONS
    //
    function _balanceOfAt(address _owner, uint256 _blockNumber) internal view returns (Decimal.decimal memory) {
        return Decimal.decimal(balancesHistory[_owner].getValueAt(_blockNumber.toUint64Time()));
    }

    function _totalSupplyAt(uint256 _blockNumber) internal view returns (Decimal.decimal memory) {
        return Decimal.decimal(totalSupplyHistory.getValueAt(_blockNumber.toUint64Time()));
    }

    function requireNonZeroAmount(Decimal.decimal memory _amount) private pure {
        require(_amount.toUint() > 0, "Amount is 0.");
    }

    function requireNotInCoolDown(address _staker) private view {
        require(stakerCooldown[_staker] == 0, "Still in cooldown.");
    }
}
