// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "../interfaces/ITimeLockPool.sol";
import "../interfaces/ISGLMR.sol";

contract MockSGLMRStaking is ITimeLockPool {
    address public sGLMR;

    constructor(address _sGLMR) {
        sGLMR = _sGLMR;
    }

    function deposit(uint256 _amount, uint256 _duration, address _receiver) public {
        ISGLMR(sGLMR).transferFrom(msg.sender, address(this), _amount);
    }

    function distributeRewards(address _reward, uint256 _amount) public {
        ISGLMR(_reward).transferFrom(msg.sender, address(this), _amount);
    }
}