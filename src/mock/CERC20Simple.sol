// SPDX-License-Identifier: BSD-3-CLAUSE
pragma solidity 0.6.9;

import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { ContextUpgradeSafe } from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";
import { SafeMath } from "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import { CErc20 } from "../exchangeWrapper/Compound/CTokenInterface.sol";

contract CERC20Simple is CErc20, ContextUpgradeSafe {
    using SafeMath for uint256;

    // prettier-ignore
    address public override underlying;

    string public name;
    string public symbol;
    uint8 public decimals;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function initialize(
        address _underlying,
        uint256 _initialSupply,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public initializer {
        __Context_init_unchained();
        _mint(_msgSender(), _initialSupply);

        underlying = _underlying;
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _totalSupply = _initialSupply;
    }

    // prettier-ignore
    function mint(uint256 mintAmount) external   override returns (uint256) {}

    // prettier-ignore
    function redeem(uint256 redeemTokens) external   override returns (uint256) {}

    // prettier-ignore
    function redeemUnderlying(uint256 redeemAmount) external   override returns (uint256) {}

    // prettier-ignore
    function borrow(uint256 borrowAmount) external   override returns (uint256) {}

    // prettier-ignore
    function repayBorrow(uint256 repayAmount) external   override returns (uint256) {}

    // prettier-ignore
    function repayBorrowBehalf(address borrower, uint256 repayAmount) external  override returns (uint256) {}

    // prettier-ignore
    function transfer( address receiver, uint256 amount) external  override returns (bool) {
        _transfer(_msgSender(), receiver, amount);
        return true;
    }

    // prettier-ignore
    function transferFrom(address sender, address receiver, uint256 amount)
        external  
        override
        returns (bool)
    {
        _transfer(sender, receiver, amount);
        _approve(
            sender,
            _msgSender(),
            _allowances[sender][_msgSender()].sub(amount, "ERC20: transfer amount exceeds allowance")
        );
        return true;
    }

    // prettier-ignore
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    // prettier-ignore
    function allowance(address owner, address spender) external  override view returns (uint256) {
        return _allowances[owner][spender];
    }

    // prettier-ignore
    function balanceOf(address owner) external override view returns (uint256) {
        return _balances[owner];
    }

    // prettier-ignore
    function balanceOfUnderlying(address owner) external  override returns (uint256) {}

    // prettier-ignore
    function getAccountSnapshot(address account) external  override view returns (uint256, uint256, uint256, uint256) {}

    // prettier-ignore
    function borrowRatePerBlock() external  override view returns (uint256) {}

    // prettier-ignore
    function supplyRatePerBlock() external  override view returns (uint256) {}

    // prettier-ignore
    function totalBorrowsCurrent() external  override returns (uint256) {}

    // prettier-ignore
    function borrowBalanceCurrent(address account) external  override returns (uint256) {}

    // prettier-ignore
    function borrowBalanceStored(address account) external  override view returns (uint256) {}

    // prettier-ignore
    function exchangeRateCurrent() external  override returns (uint256) {}

    // prettier-ignore
    function exchangeRateStored() external  override view returns (uint256) {}

    // prettier-ignore
    function getCash() external  override view returns (uint256) {}

    // prettier-ignore
    function accrueInterest() external  override returns (uint256) {}

    // prettier-ignore
    function seize(address liquidator, address borrower, uint256 seizeTokens) external  override returns (uint256) {}

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Moves tokens `amount` from `sender` to `recipient`.
     *
     * This is internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        _balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amount);
        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`s tokens.
     *
     * This is internal function is equivalent to `approve`, and can be used to
     * e.g. set automatic allowances for certain subsystems, etc.
     *
     * Emits an {Approval} event.
     *
     * Requirements:
     *
     * - `owner` cannot be the zero address.
     * - `spender` cannot be the zero address.
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be to transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
