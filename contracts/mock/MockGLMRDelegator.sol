// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "../GLMRDelegator.sol";

contract MockGLMRDelegator is GLMRDelegator {

    constructor(address _stakingDelegations) 
        GLMRDelegator(_stakingDelegations) {}

     function _delegatorBondMore(address _candidate, uint256 _more) internal override {
        (bool success, ) = stakingDelegations.call{value: _more}("");
		require(success, "MockGLMRDelegator.delegatorBondMore: Transfer failed.");
        super._delegatorBondMore(_candidate, _more);
    }

    function _delegate(address _candidate, uint256 _amount) internal override {
        (bool success, ) = stakingDelegations.call{value: _amount}("");
		require(success, "MockGLMRDelegator.delegate: Transfer failed.");
        super._delegate(_candidate, _amount);
    }

    function addCandidate(address candidate, uint256 delegation) external {
        _addCandidate(candidate, delegation);
    }

     function removeCandidate(address candidate) external {
        _removeCandidate(candidate);
    }

    function increaseDelegation(address candidate, uint256 delegation) external {
        _increaseDelegation(candidate, delegation);
    }

    function reduceDelegation(address candidate, uint256 delegation) external {
        _reduceDelegation(candidate, delegation);
    }

    function updateDelegation(address candidate, uint256 newDelegation) external {
        _updateDelegation(candidate, newDelegation);
    }
}