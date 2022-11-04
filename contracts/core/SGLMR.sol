// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract SGLMR is ERC4626 {
  constructor(
        IERC20Metadata _asset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) ERC4626(_asset) {
  }
}