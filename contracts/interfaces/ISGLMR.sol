// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISGLMR is IERC20 {
    function mint(address _recipient, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
}