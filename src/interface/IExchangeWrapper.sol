// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.9;
pragma experimental ABIEncoderV2;

import { Decimal } from "../utils/Decimal.sol";
import { IERC20 } from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface IExchangeWrapper {
    function swapInput(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal calldata inputTokenSold,
        Decimal.decimal calldata minOutputTokenBought,
        Decimal.decimal calldata maxPrice
    ) external returns (Decimal.decimal memory);

    function swapOutput(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal calldata outputTokenBought,
        Decimal.decimal calldata maxInputTokeSold,
        Decimal.decimal calldata maxPrice
    ) external returns (Decimal.decimal memory);

    function getInputPrice(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal calldata inputTokenSold
    ) external view returns (Decimal.decimal memory);

    function getOutputPrice(
        IERC20 inputToken,
        IERC20 outputToken,
        Decimal.decimal calldata outputTokenBought
    ) external view returns (Decimal.decimal memory);

    function getSpotPrice(IERC20 inputToken, IERC20 outputToken) external view returns (Decimal.decimal memory);
}
