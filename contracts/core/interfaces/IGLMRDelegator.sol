// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IGLMRDelegator {
     function harvest(address _receiver) external;
     function runDelegate(address _candidate, uint256  _amount) external;
     function runScheduleWithdraw(uint256 _amount) external;
     function runWithdraw(address _receiver, uint256 _amount, bool redelegate) external;
     function runSingleScheduleWithdraw(address _candidate, uint256 _amount) external;
     function runExecuteAllDelegationRequests() external;
     function runEmergencyRecall(address _receiver) external;
}