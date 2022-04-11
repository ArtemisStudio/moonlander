// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IGLMRDelegator {
     function runDelegate(address _candidate, uint256  _amount) external;
     function runScheduleWithdraw(uint256 _amount) external;
     function runWithdraw(address _receiver, uint256 _amount, bool redelegate) external;
}