// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { IERC20 } from "./interface/IERC20.sol";
import { Decimal } from "./utils/Decimal.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { IRewardRecipient } from "./interface/IRewardRecipient.sol";

contract RewardsDistribution is PerpFiOwnableUpgrade, BlockContext, DecimalERC20 {
    using Decimal for Decimal.decimal;

    //
    // EVENTS
    //
    event RewardDistributed(uint256 reward, uint256 timestamp);

    //
    // STRUCT
    //
    /**
     * @notice Stores an address and amount
     * of the inflationary supply to sent to the address.
     */
    struct DistributionData {
        address destination;
        Decimal.decimal amount;
    }

    //**********************************************************//
    //    The below state variables can not change the order    //
    //**********************************************************//

    address private rewardsController;
    IRewardRecipient private defaultRecipient;

    /**
     * @notice An array of addresses and amounts to send.
     * this provide the flexibility for owner (DAO) to add more incentive program.
     * eg. share 1000 PERP to another smart contract which will reward PERP/USDC Balancer LP
     */
    DistributionData[] public distributions;

    //**********************************************************//
    //    The above state variables can not change the order    //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    //
    // FUNCTIONS
    //

    function initialize(address _rewardsController, IRewardRecipient _defaultRecipient) public initializer {
        __Ownable_init();

        rewardsController = _rewardsController;
        defaultRecipient = _defaultRecipient;
    }

    function distributeRewards(IERC20 _perpToken, Decimal.decimal memory _amount) public {
        require(_msgSender() == rewardsController, "!_rewardsController");

        require(_balanceOf(_perpToken, address(this)).toUint() >= _amount.toUint(), "not enough PERP");

        // Iterate the array of distributions sending the configured amounts
        // the size of the distributions array will be controlled by owner (dao)
        // owner should be aware of not making this array too large
        Decimal.decimal memory remainder = _amount;
        for (uint256 i = 0; i < distributions.length; i++) {
            if (distributions[i].destination != address(0) && distributions[i].amount.toUint() != 0) {
                remainder = remainder.subD(distributions[i].amount);

                // Transfer the PERP
                _transfer(_perpToken, distributions[i].destination, distributions[i].amount);

                bytes memory payload = abi.encodeWithSignature("notifyRewardAmount(uint256)", distributions[i].amount);

                // solhint-disable avoid-low-level-calls
                (bool success, ) = distributions[i].destination.call(payload);

                // solhint-disable no-empty-blocks
                if (!success) {
                    // we're ignoring the return value as
                    // it will fail for contracts that do not implement IRewardRecipient.sol
                }
            }
        }

        // staker will share all the remaining PERP reward
        _transfer(_perpToken, address(defaultRecipient), remainder);
        defaultRecipient.notifyRewardAmount(remainder);

        emit RewardDistributed(_amount.toUint(), _blockTimestamp());
    }

    function addRewardsDistribution(address _destination, Decimal.decimal memory _amount) public onlyOwner {
        require(_destination != address(0), "Cant add a zero address");
        require(_amount.toUint() != 0, "Cant add a zero amount");

        DistributionData memory rewardsDistribution = DistributionData(address(_destination), _amount);
        distributions.push(rewardsDistribution);
    }

    function removeRewardsDistribution(uint256 _index) external onlyOwner {
        require(distributions.length != 0 && _index <= distributions.length - 1, "index out of bounds");

        if (_index < distributions.length - 1) {
            distributions[_index] = distributions[distributions.length - 1];
        }
        distributions.pop();
    }

    function editRewardsDistribution(
        uint256 _index,
        address _destination,
        Decimal.decimal memory _amount
    ) public onlyOwner {
        require(distributions.length != 0 && _index <= distributions.length - 1, "index out of bounds");

        distributions[_index].destination = _destination;
        distributions[_index].amount = _amount;
    }
}
