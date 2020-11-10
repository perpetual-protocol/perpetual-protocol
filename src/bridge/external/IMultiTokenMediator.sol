// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

interface IMultiTokenMediator {
    function relayTokens(
        address token,
        address _receiver,
        uint256 _value
    ) external;
}
