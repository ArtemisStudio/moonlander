// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
interface IRewarder {

    function onLanderReward(address user, uint256 newLpAmount) external;

    function pendingTokens(address user) external view returns (uint256 pending);

    function rewardToken() external view returns (IERC20Metadata);
}