// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { PerpFiOwnableUpgrade } from "./utils/PerpFiOwnableUpgrade.sol";
import { Decimal, SafeMath } from "./utils/Decimal.sol";
import { DecimalERC20 } from "./utils/DecimalERC20.sol";
import { IMinter } from "./interface/IMinter.sol";
import { BlockContext } from "./utils/BlockContext.sol";
import { IInflationMonitor } from "./interface/IInflationMonitor.sol";

// record the extra inflation due to the unexpected loss
contract InflationMonitor is IInflationMonitor, PerpFiOwnableUpgrade, BlockContext, DecimalERC20 {
    using Decimal for Decimal.decimal;
    using SafeMath for uint256;

    /**
     * @notice Stores timestamp and cumulative amount of minted token
     */
    struct MintedTokenEntry {
        uint256 timestamp;
        Decimal.decimal cumulativeAmount;
    }

    uint256 public constant MINT_THRESHOLD_PERIOD = 1 weeks;

    //**********************************************************//
    //    Can not change the order of below state variables     //
    //**********************************************************//

    // An array of token mint timestamp and cumulative amount
    MintedTokenEntry[] private mintedTokenHistory;

    /**
     * @notice in percentage, if (minted token in a week) / (total supply) is less than `shutdownThreshold`,
     * it's ready to shutdown
     */
    Decimal.decimal public shutdownThreshold;

    IMinter private minter;

    //**********************************************************//
    //    Can not change the order of above state variables     //
    //**********************************************************//

    //◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤ add state variables below ◥◤◥◤◥◤◥◤◥◤◥◤◥◤◥◤//

    //◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣ add state variables above ◢◣◢◣◢◣◢◣◢◣◢◣◢◣◢◣//
    uint256[50] private __gap;

    function initialize(IMinter _minter) public initializer {
        __Ownable_init();

        minter = _minter;
        shutdownThreshold = Decimal.one().divScalar(10);
    }

    function setShutdownThreshold(Decimal.decimal memory _shutdownThreshold) public onlyOwner {
        shutdownThreshold = _shutdownThreshold;
    }

    function appendMintedTokenHistory(Decimal.decimal calldata _amount) external override {
        require(_msgSender() == address(minter), "!minter");
        Decimal.decimal memory cumulativeAmount;
        uint256 len = mintedTokenHistory.length;
        if (len == 0) {
            cumulativeAmount = _amount;
        } else {
            cumulativeAmount = mintedTokenHistory[len - 1].cumulativeAmount.addD(_amount);
        }
        mintedTokenHistory.push(MintedTokenEntry({ timestamp: _blockTimestamp(), cumulativeAmount: cumulativeAmount }));
    }

    function mintedAmountDuringMintThresholdPeriod() public view returns (Decimal.decimal memory) {
        uint256 len = mintedTokenHistory.length;
        if (len == 0) {
            return Decimal.zero();
        }

        uint256 durationSinceLastMinted = _blockTimestamp().sub(mintedTokenHistory[len - 1].timestamp);
        if (durationSinceLastMinted > MINT_THRESHOLD_PERIOD) {
            return Decimal.zero();
        }

        Decimal.decimal memory minted;
        for (uint256 i = len - 1; i > 0; i--) {
            Decimal.decimal memory amount = mintedTokenHistory[i].cumulativeAmount.subD(
                mintedTokenHistory[i - 1].cumulativeAmount
            );
            minted = minted.addD(amount);

            durationSinceLastMinted += mintedTokenHistory[i].timestamp.sub(mintedTokenHistory[i - 1].timestamp);
            if (durationSinceLastMinted > MINT_THRESHOLD_PERIOD) {
                break;
            }
        }
        return minted;
    }

    function isOverMintThreshold() external view override returns (bool) {
        if (shutdownThreshold.toUint() == 0) {
            return false;
        }
        Decimal.decimal memory totalSupply = _totalSupply(minter.getPerpToken());
        Decimal.decimal memory minted = mintedAmountDuringMintThresholdPeriod();
        return minted.divD(totalSupply).cmp(shutdownThreshold) >= 0;
    }
}
