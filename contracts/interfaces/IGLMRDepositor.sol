// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

interface IGLMRDepositor {
    function deposit(address _receiver) payable external;
}