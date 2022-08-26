// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../base/TokenSaver.sol";
import "./interfaces/IGLMRDepositor.sol";
import "./interfaces/IGLMRDelegator.sol";
import "./interfaces/IMGLMR.sol";

contract GLMRRewardCollector is TokenSaver, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public glmrDelegator;
    address public glmrDepositor;
    address public mGLMR;
    address public sGLMR;

    event GLMRDepositorUpdated(address glmrDepositor);
    event GLMRDelegatorUpdated(address glmrDelegator);
    event MGLMRUpdated(address mGLMR);
    event SGLMRUpdated(address sGLMR);

    constructor(address _glmrDelegator, address _glmrDepositor, address _mGLMR, address _sGLMR) {
        require(_glmrDelegator != address(0), "GLMRRewardCollector.constructor: glmrDelegator cannot be zero address");
        require(_glmrDepositor != address(0), "GLMRRewardCollector.constructor: glmrDepositor cannot be zero address");
        require(_mGLMR != address(0), "GLMRRewardCollector.constructor: mGLMR cannot be zero address");
        require(_sGLMR != address(0), "GLMRRewardCollector.constructor: sGLMR cannot be zero address");

        glmrDelegator = _glmrDelegator;
        glmrDepositor = _glmrDepositor;
        mGLMR = _mGLMR;
        sGLMR = _sGLMR;

        _setupRole(ADMIN_ROLE, msg.sender);

        IMGLMR(_mGLMR).approve(_sGLMR, type(uint256).max);

        emit GLMRDelegatorUpdated(_glmrDelegator);
        emit GLMRDepositorUpdated(_glmrDepositor);
        emit MGLMRUpdated(_mGLMR);
        emit SGLMRUpdated(_sGLMR);
    }

    receive() external payable {}

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "GLMRRewardCollector.onlyAdmin: permission denied");
        _;
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

    function updateGLMRDelegator(address _newGLMRDelegator) external onlyAdmin {
        require(_newGLMRDelegator != address(0), "GLMRRewardCollector.updateGLMRDelegator: glmrDelegator cannot be zero address");
        glmrDelegator = _newGLMRDelegator;
        emit GLMRDelegatorUpdated(_newGLMRDelegator);
    }

    function updateGLMRDepositor(address _newGLMRDepositor) external onlyAdmin {
        require(_newGLMRDepositor != address(0), "GLMRRewardCollector.updateGLMRDepositor: glmrDepositor cannot be zero address");
        glmrDepositor = _newGLMRDepositor;
        emit GLMRDepositorUpdated(_newGLMRDepositor);
    }

    function updateMGLMR(address _newMGLMR) external onlyAdmin {
        require(_newMGLMR != address(0), "GLMRRewardCollector.updateMGLMR: mGLMR cannot be zero address");
        mGLMR = _newMGLMR;
        emit MGLMRUpdated(_newMGLMR);
    }

    function updateSGLMR(address _newSGLMR) external onlyAdmin {
        require(_newSGLMR != address(0), "GLMRRewardCollector.updateSGLMR: sGLMR cannot be zero address");
        sGLMR = _newSGLMR;
        emit SGLMRUpdated(_newSGLMR);
    }

    function distributeReward() external onlyAdmin {
        IGLMRDelegator(glmrDelegator).harvest(address(this));
        if (balances() == 0) {
            return;
        }
        IGLMRDepositor(glmrDepositor).deposit{ value: balances() }(address(this));
        uint256 mGLMRBalance = IMGLMR(mGLMR).balanceOf(address(this));
        if (mGLMRBalance == 0) {
            return;
        }
        // distribute rewards to sGLMR
        IMGLMR(mGLMR).transfer(sGLMR,mGLMRBalance);
        
    }
}