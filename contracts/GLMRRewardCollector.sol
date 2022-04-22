// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./base/TokenSaver.sol";
import "./interfaces/IGLMRDepositor.sol";
import "./interfaces/IGLMRDelegator.sol";
import "./interfaces/ISGLMR.sol";
import "./interfaces/IMultiRewardsBasePool.sol";

contract GLMRRewardCollector is TokenSaver, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public glmrDelegator;
    address public glmrDepositor;
    address public sGLMR;
    address public sGLMRStakingPool;

    event GLMRDepositorSet(address glmrDepositor);
    event GLMRDelegatorSet(address glmrDelegator);
    event SGLMRSet(address sGLMR);
    event SGLMRStakingPoolSet(address sGLMRStakingPool);

    constructor(address _glmrDelegator, address _glmrDepositor, address _sGLMR, address _sGLMRStakingPool) {
        require(_glmrDelegator != address(0), "GLMRRewardCollector.constructor: glmrDelegator cannot be zero address");
        require(_glmrDepositor != address(0), "GLMRRewardCollector.constructor: glmrDepositor cannot be zero address");
        require(_sGLMR != address(0), "GLMRRewardCollector.constructor: sGLMR cannot be zero address");
        require(_sGLMRStakingPool != address(0), "GLMRRewardCollector.constructor: sGLMRStakingPool cannot be zero address");

        glmrDelegator = _glmrDelegator;
        glmrDepositor = _glmrDepositor;
        sGLMR = _sGLMR;
        sGLMRStakingPool = _sGLMRStakingPool;

        _setupRole(ADMIN_ROLE, msg.sender);

        ISGLMR(_sGLMR).approve(_sGLMRStakingPool, type(uint256).max);

        emit GLMRDelegatorSet(_glmrDelegator);
        emit GLMRDepositorSet(_glmrDepositor);
        emit SGLMRSet(_sGLMR);
        emit SGLMRStakingPoolSet(_sGLMRStakingPool);
    }

    receive() external payable {}

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "GLMRRewardCollector.onlyAdmin: permission denied");
        _;
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

    function distributeReward() external onlyAdmin {
        IGLMRDelegator(glmrDelegator).harvest(address(this));
        if (balances() == 0) {
            return;
        }
        IGLMRDepositor(glmrDepositor).deposit{ value: balances() }(address(this));
        uint256 sGLMRBalance = ISGLMR(sGLMR).balanceOf(address(this));
        if (sGLMRBalance == 0) {
            return;
        }
        IMultiRewardsBasePool(sGLMRStakingPool).distributeRewards(sGLMR, sGLMRBalance);
    }
}