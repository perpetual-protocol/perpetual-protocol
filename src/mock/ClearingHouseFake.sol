// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import "../ClearingHouse.sol";
import "../interface/IAmm.sol";

// temporary commented unused functions to bypass contract too large error
contract ClearingHouseFake is ClearingHouse {
    uint256 private timestamp = 1444004400;
    uint256 private number = 10001;

    function initialize_Fake(
        uint256 _initMarginRatio,
        uint256 _maintenanceMarginRatio,
        uint256 _liquidationFeeRatio,
        IInsuranceFund _insuranceFund,
        address _trustedForwarder
    ) external initializer {
        require(address(_insuranceFund) != address(0), "Invalid IInsuranceFund");

        __OwnerPausable_init();
        __ReentrancyGuard_init();

        versionRecipient = "1.0.0"; // we are not using it atm
        initMarginRatio = Decimal.decimal(_initMarginRatio);
        maintenanceMarginRatio = Decimal.decimal(_maintenanceMarginRatio);
        liquidationFeeRatio = Decimal.decimal(_liquidationFeeRatio);
        insuranceFund = _insuranceFund;
        trustedForwarder = _trustedForwarder;
    }

    function mock_setBlockTimestamp(uint256 _timestamp) public {
        timestamp = _timestamp;
    }

    function mock_setBlockNumber(uint256 _number) public {
        number = _number;
    }

    // function mock_getCurrentTimestamp() public view returns (uint256) {
    //     return _blockTimestamp();
    // }

    function mock_getCurrentBlockNumber() public view returns (uint256) {
        return _blockNumber();
    }

    // // Override BlockContext here
    function _blockTimestamp() internal view override returns (uint256) {
        return timestamp;
    }

    function _blockNumber() internal view override returns (uint256) {
        return number;
    }

    function mockSetRestrictionMode(IAmm _amm) external {
        enterRestrictionMode(_amm);
    }

    function isInRestrictMode(address _amm, uint256 _block) external view returns (bool) {
        return ammMap[_amm].lastRestrictionBlock == _block;
    }

    function getPrepaidBadDebt(address _token) public view returns (Decimal.decimal memory) {
        return prepaidBadDebt[_token];
    }
}
