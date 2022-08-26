// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "../core/interfaces/IParachainStaking.sol";
import "hardhat/console.sol";

contract MockParachainStaking is IParachainStaking {
    address public glmrDelegator;
    mapping(address => uint256) public amountDelegated; 
    mapping(address => uint256) public amountScheduled;

    constructor() {}

    receive() external payable {}

    function setGLMRDelegator(address _glmrDelegator) external {
        glmrDelegator = _glmrDelegator;
    }

    function is_delegator(address delegator) external view returns (bool) {}

    function is_candidate(address candidate) external view returns (bool) {}

    function is_selected_candidate(address candidate) external view returns (bool) {}

    function points(uint256 round) external view returns (uint256) {}

    function min_delegation() external view returns (uint256) {
        return 5 ether;
    }

    function candidate_count() external view returns (uint256) {}

    function candidate_delegation_count(address candidate) external view returns (uint256) {
        return 0;
    }

    function delegator_delegation_count(address delegator) external view returns (uint256) {
        return 0;
    }

    function join_candidates(uint256 amount, uint256 candidateCount) external {}

    function schedule_leave_candidates(uint256 candidateCount) external {}

    function execute_leave_candidates(address candidate, uint256 candidateDelegationCount) external {}

    function cancel_leave_candidates(uint256 candidateCount) external {}

    function go_offline() external {}

    function go_online() external {}

    function candidate_bond_more(uint256 more) external {}

    function schedule_candidate_bond_less(uint256 less) external {}

    function execute_candidate_bond_less(address candidate) external {}

    function cancel_candidate_bond_less() external {}

    function delegate(
        address candidate,
        uint256 amount,
        uint256 candidateDelegationCount,
        uint256 delegatorDelegationCount
    ) external {
        amountDelegated[candidate] = amount;
    }

    function schedule_leave_delegators() external {}

    function execute_leave_delegators(address delegator, uint256 delegatorDelegationCount) external {}

    function cancel_leave_delegators() external {}

    function schedule_revoke_delegation(address candidate) external {
        amountScheduled[candidate] += amountDelegated[candidate];
        amountDelegated[candidate] = 0;
    }

    function delegator_bond_more(address candidate, uint256 more) external {
        amountDelegated[candidate] += more;
    }
    
    function schedule_delegator_bond_less(address candidate, uint256 less) external {
        amountScheduled[candidate] += less;
        amountDelegated[candidate] -= less;
    }

    function execute_delegation_request(address delegator, address candidate) external {
        uint256 amountScheduled = amountScheduled[candidate];
        (bool success, ) = glmrDelegator.call{value: amountScheduled}("");
		require(success, "MockParachainStaking.execute_delegation_request: Transfer failed.");
    }

    function cancel_delegation_request(address candidate) external {}
}