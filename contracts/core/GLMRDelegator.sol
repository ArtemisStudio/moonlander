// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/security/Pausable.sol";
import "../base/TokenSaver.sol";
import "./interfaces/IParachainStaking.sol";
import "hardhat/console.sol";

contract GLMRDelegator is TokenSaver, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");
    bytes32 public constant REWARD_COLLECTOR_ROLE = keccak256("REWARD_COLLECTOR_ROLE");

    address public immutable stakingDelegations;

    mapping(address => uint256) public delegations;
    mapping(address => address) private _nextCandidates;
    uint256 public listSize;
    address constant GUARD = address(1);

    uint256 public totalDelegated;
    uint256 public totalScheduled;

    address[] public pendingCandidates;
    mapping(address => bool) public candidateWithPendingRequest;

    event StakingDelegationsSet(address stakingDelegations);
    event CandidateAdded(address indexed candidate, uint256 delegation);
    event CandidateRemoved(address candidate);
    event DelegationIncreased(address indexed candidate, uint256 increased);
    event DelegationReduced(address indexed candidate, uint256 reduced);
    event TotalDelegatedUpdated(uint256 totalDelegated);
    event TotalScheduledUpdated(uint256 totalScheduled);
    event RewardsHarvested(address receiver, uint256 amount);
    
    event DelegatorDelegated(address indexed candidate, uint256 amount);
    event DelegatorMoreBonded(address indexed canidate, uint256 more);
    event DelegatorLessBonded(address indexed candidate, uint256 less);
    event DelegatorRevokeScheduled(address indexed candidate);
    event DelegationRequestExecuted(address indexed candidate);

    constructor(address _stakingDelegations) {
        require(_stakingDelegations != address(0), "GLMRDelegator.constructor: stakingDelegations cannot be zero address");
        stakingDelegations = _stakingDelegations;
        _nextCandidates[GUARD] = GUARD;

        _setupRole(ADMIN_ROLE, msg.sender);

        emit StakingDelegationsSet(_stakingDelegations);
    }

    receive() external payable {}

    function runDelegate(address _candidate, uint256 _amount) external onlyDepositor whenNotPaused {
        require(_candidate != address(0), "GLMRDelegator.runDelegate: candidate cannot be zero address");
        require(_amount > 0, "GLMRDelegator.runDelegate: cannot delegate 0 amount");
        require(balances() >= _amount, "GLMRDelegator.runDelegate: no enough GLMRs");

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

    function runSingleScheduleWithdraw(address _candidate, uint256 _amount) external onlyDepositor whenNotPaused {
        require(_amount > 0, "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw 0 amount");
        require(_candidate != address(0), "GLMRDelegator.runSingleScheduleWithdraw: candidate cannot be zero address");
        require(candidateExist(_candidate), "GLMRDelegator.runSingleScheduleWithdraw: candidate not in the delegation list");
        uint256 delegatedAmount = delegations[_candidate];
        require(delegatedAmount >= _amount, "GLMRDelegator.runSingleScheduleWithdraw: not enough GLMR delegated");

        uint256 remainingAmount = delegatedAmount - _amount;
        if (remainingAmount >= minDelegation()) {
            _scheduleDelegatorBondLess(_candidate, _amount);
            _reduceDelegation(_candidate, _amount);
            totalDelegated -= _amount;
            totalScheduled += _amount;
        } else {
            require(remainingAmount == 0, "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw below minimum delegation without revoke");
            _scheduleRevokeDelegation(_candidate);
            _removeCandidate(_candidate);
            totalDelegated -= delegatedAmount;
            totalScheduled += delegatedAmount;
        }
        if (!candidateWithPendingRequest[_candidate]) {
            pendingCandidates.push(_candidate);
            candidateWithPendingRequest[_candidate] = true;
        }

        emit TotalDelegatedUpdated(totalDelegated);
        emit TotalScheduledUpdated(totalScheduled);
    }

    function runExecuteAllDelegationRequests() external onlyDepositor whenNotPaused {
        for (uint i=0; i<pendingCandidates.length; i++) {
            address candidate = pendingCandidates[i];

            if (candidateWithPendingRequest[candidate]) {
                _executeDelegationRequest(candidate);
                candidateWithPendingRequest[candidate] = false;
            }
        }
        delete pendingCandidates;
    }

    function runWithdraw(address _receiver, uint256 _amount, bool redelegate) external onlyDepositor whenNotPaused {
        require(_receiver != address(0), "GLMRDelegator.runWithdraw: receiver cannot be zero address");
        require(_amount > 0, "GLMRDelegator.runWithdraw: cannot withdraw 0 amount");
        require(balances() >= _amount, "GLMRDelegator.runWithdraw: no enough GLMRs");
        require(totalScheduled >= _amount, "GLMRDelegator.runWithdraw: no enough scheduled GLMRs");

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
        
        totalScheduled -= _amount;
        emit TotalScheduledUpdated(totalScheduled);
    }

    function harvest(address _receiver) external onlyRewardCollector whenNotPaused {
        require(_receiver != address(0), "GLMRDelegator.harvest: receiver cannot be zero address");
        uint256 harvestAmount = availableToHarvest();
        (bool success, ) = _receiver.call{value: harvestAmount}("");
		require(success, "GLMRDelegator.harvest: Transfer failed.");
        emit RewardsHarvested(_receiver, harvestAmount);
    }

    /* ======== View Functions ======== */
    function availableToHarvest() public view returns(uint256) {
        uint256 currentBalance = balances();
        if (currentBalance <= totalScheduled) {
            return 0;
        } 
        return currentBalance - totalScheduled;
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

     function getPendingCandidatesLength() public view returns(uint256) {
        return pendingCandidates.length;
    }

    /* ======== Modifier Functions ======== */
    modifier onlyAdmin() {
        require(
            hasRole(ADMIN_ROLE, msg.sender), 
            "GLMRDelegator.onlyAdmin: permission denied");
        _;
    }

    modifier onlyDepositor() {
        require(
            hasRole(DEPOSITOR_ROLE, msg.sender), 
            "GLMRDelegator.onlyDepositor: permission denied");
        _;
    }

    modifier onlyRewardCollector() {
        require(
            hasRole(REWARD_COLLECTOR_ROLE, msg.sender), 
            "GLMRDelegator.onlyRewardCollector: permission denied");
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
        _updateDelegation(candidate, delegations[candidate] + delegation);
        emit DelegationIncreased(candidate, delegation);
    }

    function _reduceDelegation(address candidate, uint256 delegation) internal {
        require(delegations[candidate] >= delegation, "GLMRDelegator._reduceDelegation: reduce to much");
        _updateDelegation(candidate, delegations[candidate] - delegation);
        emit DelegationReduced(candidate, delegation);
    }

    function _updateDelegation(address candidate, uint256 newDelegation) internal {
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
        require(_candidate != address(0), "GLMRDelegator._delegate: candidate cannot be zero address");
        require(_amount > 0, "GLMRDelegator._delegate: cannot delegate 0 amount");
        uint256 candidateDelegationCount = IParachainStaking(stakingDelegations).candidate_delegation_count(_candidate);
        uint256 delegatorDelegationCount = IParachainStaking(stakingDelegations).delegator_delegation_count(address(this));
        IParachainStaking(stakingDelegations).delegate(_candidate, _amount, candidateDelegationCount, delegatorDelegationCount);
        emit DelegatorDelegated(_candidate, _amount);
    }

    function _delegatorBondMore(address _candidate, uint256 _more) internal virtual {
        require(_candidate != address(0), "GLMRDelegator._delegatorBondMore: candidate cannot be zero address");
        require(_more > 0, "GLMRDelegator._delegatorBondMore: cannot bond more 0 amount");
        IParachainStaking(stakingDelegations).delegator_bond_more(_candidate, _more);
        emit DelegatorMoreBonded(_candidate, _more);
    }

    function _scheduleDelegatorBondLess(address _candidate, uint256 _less) internal {
        require(_candidate != address(0), "GLMRDelegator._scheduleDelegatorBondLess: candidate cannot be zero address");
        require(_less > 0, "GLMRDelegator._scheduleDelegatorBondLess: cannot bond less 0 amount");
        IParachainStaking(stakingDelegations).schedule_delegator_bond_less(_candidate, _less);
        emit DelegatorLessBonded(_candidate, _less);
    }

    function _scheduleRevokeDelegation(address _candidate) internal {
        require(_candidate != address(0), "GLMRDelegator._scheduleRevokeDelegation: candidate cannot be zero address");
        require(candidateExist(_candidate), "GLMRDelegator._scheduleRevokeDelegation: candidate not in the delegation list");
        IParachainStaking(stakingDelegations).schedule_revoke_delegation(_candidate);
        emit DelegatorRevokeScheduled(_candidate);
    }

    function _executeDelegationRequest(address _candidate) internal {
        require(_candidate != address(0), "GLMRDelegator._executeDelegationRequest: candidate cannot be zero address");
        IParachainStaking(stakingDelegations).execute_delegation_request(address(this), _candidate);
        emit DelegationRequestExecuted(_candidate);
    }

    /* ======== Admin Functions ======== */
    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    /* ======== Emergency Functions ======== */
    function executeDelegationRequest(address _candidate) external onlyAdmin whenPaused {
        _executeDelegationRequest(_candidate);
    }

    function scheduleRevokeDelegation(address _candidate) external onlyAdmin whenPaused {
        _scheduleRevokeDelegation(_candidate);
    }

    function runEmergencyRecall(address _receiver) external onlyDepositor whenPaused {
        (bool success, ) = _receiver.call{value: balances()}("");
        require(success, "GLMRDelegator.runEmergencyRecall: Transfer failed.");
    }
}