// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "./base/TokenSaver.sol";
import "./interfaces/IParachainStaking.sol";

contract GLMRDelegator is TokenSaver {
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant ASSETS_MANAGER_ROLE = keccak256("ASSETS_MANAGER_ROLE");
    bytes32 public constant REWARD_COLLECTOR_ROLE = keccak256("REWARD_COLLECTOR_ROLE");

    address public immutable stakingDelegations;

    mapping(address => uint256) public delegations;
    mapping(address => address) private _nextCandidates;
    uint256 public listSize;
    address constant GUARD = address(1);

    uint256 public totalDelegated;
    uint256 public totalPending;

    event StakingDelegationsSet(address stakingDelegations);
    event CandidateAdded(address indexed candidate, uint256 delegation);
    event CandidateRemoved(address candidate);
    event DelegationIncreased(address indexed candidate, uint256 increased);
    event DelegationReduced(address indexed candidate, uint256 reduced);
    event TotalDelegatedUpdated(uint256 totalDelegated);
    event TotalPendingUpdated(uint256 totalPending);
    event RewardsHarvested(address receiver, uint256 amount);

    constructor(address _stakingDelegations) {
        require(_stakingDelegations != address(0), "GLMRDelegator.constructor: stakingDelegations cannot be zero address");
        stakingDelegations = _stakingDelegations;
        _nextCandidates[GUARD] = GUARD;

        _setupRole(ASSETS_MANAGER_ROLE, msg.sender);

        emit StakingDelegationsSet(_stakingDelegations);
    }

    receive() external payable {}

    function runDelegate(address _candidate, uint256 _amount) external onlyDepositor {
        require(_candidate != address(0), "GLMRDelegator.runDelegate: candidate cannot be zero address");
        require(_amount > 0, "GLMRDelegator.runDelegate: cannot delegate 0 amount");
        require(balances() >= _amount, "GLMRDelegator.runDelegate: no enought GLMRs");

        if (candidateExist(_candidate)) {
            _delegatorBondMore(_candidate, _amount);
            _increaseDelegation(_candidate, _amount);
        } else {
            require(_amount >= minDelegation(), "GLMRDelegator.runDelegate: need to meet the minimum delegation amount");
            _delegate(_candidate, _amount);
            _addCandidate(_candidate, _amount);
        }
        totalDelegated += _amount;
        emit TotalDelegatedUpdated(totalDelegated);
    }

    function runScheduleWithdraw(uint256 _amount) external onlyDepositorOrAssetsManager {
        require(_amount > 0, "GLMRDelegator.runScheduleWithdraw: cannot schedule withdraw 0 amount");
        require(totalDelegated >= _amount, "GLMRDelegator.runScheduleWithdraw: not enough GLMR delegated for withdraw");

        uint256 remainingAmount = _amount;
        address[] memory candidateLists = getTop(listSize);
        for (uint i=0; i<candidateLists.length; i++) {
            if (remainingAmount <= 0) {
                break;
            }

            address candidate = candidateLists[i];
            uint256 delegatedAmount = delegations[candidate];
            uint256 withdrawableAmount = delegatedAmount > minDelegation() ? delegatedAmount - minDelegation() : 0;
            uint256 amount;
            if (withdrawableAmount == 0) {
                continue;
            }
            if (withdrawableAmount >= remainingAmount) {
                amount = remainingAmount;
            } else {
                amount = withdrawableAmount;
            }

            _scheduleDelegatorBondLess(candidate, amount);
            _reduceDelegation(candidate, amount);
            totalDelegated -= amount;
            totalPending += amount;
            remainingAmount -= amount;
        }

        require(remainingAmount == 0, "GLMRDelegator.runScheduleWithdraw: not enough GLMR to schedule withdraw");
        
        emit TotalDelegatedUpdated(totalDelegated);
        emit TotalPendingUpdated(totalPending);
    }

    function runSingleScheduleWithdraw(address _candidate, uint256 _amount) external onlyAssetsManager {
        require(_amount > 0, "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw 0 amount");
        require(_candidate != address(0), "GLMRDelegator.runSingleScheduleWithdraw: candidate cannot be zero address");
        require(candidateExist(_candidate), "GLMRDelegator.runSingleScheduleWithdraw: candidate not in the delegation list");
        
        uint256 delegatedAmount = delegations[_candidate];
        uint256 withdrawableAmount = delegatedAmount > minDelegation() ? delegatedAmount - minDelegation() : 0;
        require(withdrawableAmount > 0, "GLMRDelegator.runSingleScheduleWithdraw: cannot withdraw below minimun delegation");
        require(withdrawableAmount >= _amount, "GLMRDelegator.runSingleScheduleWithdraw: not enought delegated amount");

        _scheduleDelegatorBondLess(_candidate, _amount);
        _reduceDelegation(_candidate, _amount);
        totalDelegated -= _amount;
        totalPending += _amount;

        emit TotalDelegatedUpdated(totalDelegated);
        emit TotalPendingUpdated(totalPending);
    }

    function runSingleScheduleRevoke(address _candidate) external onlyAssetsManager {
        require(_candidate != address(0), "GLMRDelegator.runSingleScheduleRevoke: candidate cannot be zero address");
        require(candidateExist(_candidate), "GLMRDelegator.runSingleScheduleRevoke: candidate not in the delegation list");
        uint256 delegatedAmount = delegations[_candidate];
        require(delegatedAmount > 0, "GLMRDelegator.runSingleScheduleRevoke: no GLMR delegated");

        _scheduleRevokeDelegation(_candidate);
        _removeCandidate(_candidate);
        totalDelegated -= delegatedAmount;
        totalPending += delegatedAmount;

        emit TotalDelegatedUpdated(totalDelegated);
        emit TotalPendingUpdated(totalPending);
    }

    function runScheduleRevokeAll() external onlyAssetsManager {
        require(totalDelegated > 0, "GLMRDelegator.runScheduleRevokeAll: no delegated GLMRs");

        address[] memory candidateLists = getTop(listSize);
        for (uint i=0; i<candidateLists.length; i++) {
            address candidate = candidateLists[i];
            uint256 delegatedAmount = delegations[candidate];

            if (delegatedAmount > 0) {
                _scheduleRevokeDelegation(candidate);
                _removeCandidate(candidate);
                totalDelegated -= delegatedAmount;
                totalPending += delegatedAmount;
            }
        }

        emit TotalDelegatedUpdated(totalDelegated);
        emit TotalPendingUpdated(totalPending);
    }

    function runWithdraw(address _receiver, uint256 _amount, bool redelegate) external onlyDepositorOrAssetsManager {
        require(_receiver != address(0), "GLMRDelegator.runWithdraw: receiver cannot be zero address");
        require(_amount > 0, "GLMRDelegator.runWithdraw: cannot withdraw 0 amount");
        require(balances() >= _amount, "GLMRDelegator.runWithdraw: no enough GLMRs");
        require(totalPending >= _amount, "GLMRDelegator.runWithdraw: no enough pending GLMRs");

        if (redelegate) {
            if (candidateExist(_receiver) && delegations[_receiver] > 0) {
                _delegatorBondMore(_receiver, _amount);
                _increaseDelegation(_receiver, _amount);
            } else {
                require(_amount >= minDelegation(), "GLMRDelegator.runWithdraw: need to meet the minimum delegation amount");
                _delegate(_receiver, _amount);
                _addCandidate(_receiver, _amount);
            }
            totalDelegated += _amount;
            emit TotalDelegatedUpdated(totalDelegated);
        } else {
            (bool success, ) = _receiver.call{value: _amount}("");
		    require(success, "GLMRDelegator.runWithdraw: Transfer failed.");
        }
        
        totalPending -= _amount;
        emit TotalPendingUpdated(totalPending);
    }

    function harvest(address _receiver) external onlyRewardCollector {
        require(_receiver != address(0), "GLMRDelegator.harvest: receiver cannot be zero address");
        uint256 harvestAmount = availabeToHarvest();
        (bool success, ) = _receiver.call{value: harvestAmount}("");
		require(success, "GLMRDelegator.harvest: Transfer failed.");
        emit RewardsHarvested(_receiver, harvestAmount);
    }

    function availabeToHarvest() public view returns(uint256) {
        uint256 currentBalance = balances();
        if (currentBalance <= totalPending) {
            return 0;
        } 
        return currentBalance - totalPending;
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

    /* ======== Modifier Functions ======== */
    modifier onlyDepositor() {
        require(
            hasRole(DEPOSITOR_ROLE, msg.sender), 
            "GLMRDelegator.onlyDepositor: permission denied");
        _;
    }

    modifier onlyAssetsManager() {
        require(
            hasRole(ASSETS_MANAGER_ROLE, msg.sender), 
            "GLMRDelegator.onlyAssetsManager: permission denied");
        _;
    }

    modifier onlyRewardCollector() {
        require(
            hasRole(REWARD_COLLECTOR_ROLE, msg.sender), 
            "GLMRDelegator.onlyRewardCollector: permission denied");
        _;
    }

    modifier onlyDepositorOrAssetsManager() {
        require(
            hasRole(ASSETS_MANAGER_ROLE, msg.sender) || hasRole(DEPOSITOR_ROLE, msg.sender), 
            "GLMRDelegator.onlyDepositorOrAssetsManager: permission denied");
        _;
    }

    /* ======== Candidate List Functions ======== */
    function candidateExist(address candidate) public view returns(bool) {
        return _nextCandidates[candidate] != address(0);
    }

    function _verifyIndex(address prevCandidate, uint256 newValue, address nextCandidate) internal view returns(bool) {
        return (prevCandidate == GUARD || delegations[prevCandidate] >= newValue) && 
            (nextCandidate == GUARD || newValue > delegations[nextCandidate]);
    }

    function _findIndex(uint256 newValue) internal view returns(address) {
        address candidateAddress = GUARD;
        while(true) {
            if(_verifyIndex(candidateAddress, newValue, _nextCandidates[candidateAddress])) {
                return candidateAddress;
            }
            candidateAddress = _nextCandidates[candidateAddress];
        }
    }

    function _isPrevCandidate(address candidate, address prevCandidate) internal view returns(bool) {
        return _nextCandidates[prevCandidate] == candidate;
    }

    function _findPrevCandidate(address candidate) internal view returns(address) {
        address currentAddress = GUARD;
        while(_nextCandidates[currentAddress] != GUARD) {
            if(_isPrevCandidate(candidate, currentAddress)) {
                return currentAddress;
            }
            currentAddress = _nextCandidates[currentAddress];
        }
        return address(0);
    }

    function _addCandidate(address candidate, uint256 delegation) internal {
        require(!candidateExist(candidate), "GLMRDelegator._addCandidate: candidate already in the list");
        address index = _findIndex(delegation);
        delegations[candidate] = delegation;
        _nextCandidates[candidate] = _nextCandidates[index];
        _nextCandidates[index] = candidate;
        listSize++;
        emit CandidateAdded(candidate, delegation);
    }

    function _removeCandidate(address candidate) internal {
        require(candidateExist(candidate), "GLMRDelegator._removeCandidate: candidate not in the list");
        address prevCandidate = _findPrevCandidate(candidate);
        _nextCandidates[prevCandidate] = _nextCandidates[candidate];
        _nextCandidates[candidate] = address(0);
        delegations[candidate] = 0;
        listSize--;
        emit CandidateRemoved(candidate);
    }

    function _increaseDelegation(address candidate, uint256 delegation) internal {
        require(candidateExist(candidate), "GLMRDelegator._increaseDelegation: candidate not in the list");
        _updateDelegation(candidate, delegations[candidate] + delegation);
        emit DelegationIncreased(candidate, delegation);
    }

    function _reduceDelegation(address candidate, uint256 delegation) internal {
        require(candidateExist(candidate), "GLMRDelegator._reduceDelegation: candidate not in the list");
        require(delegations[candidate] >= delegation, "GLMRDelegator._reduceDelegation: reduce to much");
        _updateDelegation(candidate, delegations[candidate] - delegation);
        emit DelegationReduced(candidate, delegation);
    }

    function _updateDelegation(address candidate, uint256 newDelegation) internal {
        require(candidateExist(candidate), "GLMRDelegator._updateDelegation: candidate not in the list");
        address prevCandidate = _findPrevCandidate(candidate);
        address newCandidate = _nextCandidates[candidate];
        if(_verifyIndex(prevCandidate, newDelegation, newCandidate)){
            delegations[candidate] = newDelegation;
        } else {
            _removeCandidate(candidate);
            _addCandidate(candidate, newDelegation);
        }
    }

    function getTop(uint256 k) public view returns(address[] memory) {
        require(k <= listSize);
        address[] memory candidateLists = new address[](k);
        address currentAddress = _nextCandidates[GUARD];
        for(uint256 i = 0; i < k; ++i) {
            candidateLists[i] = currentAddress;
            currentAddress = _nextCandidates[currentAddress];
        }
        return candidateLists;
    }

    /* ========  Parachain Functions  ======== */
    function minDelegation() public view returns (uint256) {
       return IParachainStaking(stakingDelegations).min_delegation();
    }

    function _delegate(address _candidate, uint256 _amount) internal virtual {
        require(_candidate != address(0), "GLMRDelegator.delegate: candidate cannot be zero address");
        require(_amount > 0, "GLMRDelegator.delegate: cannot delegate 0 amount");
        uint256 candidateDelegationCount = IParachainStaking(stakingDelegations).candidate_delegation_count(_candidate);
        uint256 delegatorDelegationCount = IParachainStaking(stakingDelegations).delegator_delegation_count(address(this));
        IParachainStaking(stakingDelegations).delegate(_candidate, _amount, candidateDelegationCount, delegatorDelegationCount);
    }

    function _delegatorBondMore(address _candidate, uint256 _more) internal virtual {
        require(_candidate != address(0), "GLMRDelegator.delegatorBondMore: candidate cannot be zero address");
        require(_more > 0, "GLMRDelegator.delegatorBondMore: cannot bond more 0 amount");
        require(candidateExist(_candidate), "GLMRDelegator.delegatorBondMore: candidate not in the delegation list");
        IParachainStaking(stakingDelegations).delegator_bond_more(_candidate, _more);
    }

    function _scheduleDelegatorBondLess(address _candidate, uint256 _less) internal {
        require(_candidate != address(0), "GLMRDelegator.scheduleDelegatorBondLess: candidate cannot be zero address");
        require(_less > 0, "GLMRDelegator.scheduleDelegatorBondLess: cannot bond less 0 amount");
        IParachainStaking(stakingDelegations).schedule_delegator_bond_less(_candidate, _less);
    }

    function _scheduleRevokeDelegation(address _candidate) internal {
        require(_candidate != address(0), "GLMRDelegator.scheduleRevokeDelegation: candidate cannot be zero address");
        require(candidateExist(_candidate), "GLMRDelegator.scheduleRevokeDelegation: candidate not in the delegation list");
        IParachainStaking(stakingDelegations).schedule_revoke_delegation(_candidate);
    }

    function executeDelegationRequest(address _delegator, address _candidate) external onlyAssetsManager {
        require(_delegator != address(0), "GLMRDelegator.executeDelegationRequest: delegator cannot be zero address");
        require(_candidate != address(0), "GLMRDelegator.executeDelegationRequest: candidate cannot be zero address");
        IParachainStaking(stakingDelegations).execute_delegation_request(_delegator, _candidate);
    }

    function cancelDelegationRequest(address _candidate) external onlyAssetsManager {
        require(_candidate != address(0), "GLMRDelegator.cancelDelegationRequest: candidate cannot be zero address");
        IParachainStaking(stakingDelegations).cancel_delegation_request(_candidate);
    }

    function scheduleLeaveDelegators() public onlyAssetsManager {
        IParachainStaking(stakingDelegations).schedule_leave_delegators();
    }

    function executeLeaveDelegators() public onlyAssetsManager {
        uint256 delegatorDelegationCount = IParachainStaking(stakingDelegations).delegator_delegation_count(address(this));
        IParachainStaking(stakingDelegations).execute_leave_delegators(address(this), delegatorDelegationCount);
    }

    function cancelLeaveDelegators() public onlyAssetsManager {
        IParachainStaking(stakingDelegations).cancel_leave_delegators();
    }
}