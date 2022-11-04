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
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");

    address public glmrDelegator;
    address public glmrDepositor;
    address public mGLMR;
    address public sGLMR;
    address public treasury;
    
    uint256 public harvestIncentive; //incentive to distributor
    uint256 public treasuryFee; //possible fee to build treasury
    uint256 public constant FEE_DENOMINATOR = 10000;

    event GLMRDepositorUpdated(address glmrDepositor);
    event GLMRDelegatorUpdated(address glmrDelegator);
    event MGLMRUpdated(address mGLMR);
    event SGLMRUpdated(address sGLMR);
    event TreasuryUpdated(address treasury);
    event TreasuryFeeUpdated(uint256 treasuryFee);
    event HarvestIncentiveUpdated(uint256 harvestIncentive);

    event RewardsDistributed(address indexed to, uint256 amount);
    event TreasuryFeeIssued(address indexed to, uint256 treasuryFeeAmount);
    event HarvestIncentiveIssued(address indexed to, uint256 harvestIncentiveAmount);

    constructor(address _glmrDelegator, address _glmrDepositor, address _mGLMR, address _sGLMR, address _treasury, uint256 _treasuryFee, uint256 _harvestIncentive) {
        require(_glmrDelegator != address(0), "GLMRRewardCollector.constructor: glmrDelegator cannot be zero address");
        require(_glmrDepositor != address(0), "GLMRRewardCollector.constructor: glmrDepositor cannot be zero address");
        require(_mGLMR != address(0), "GLMRRewardCollector.constructor: mGLMR cannot be zero address");
        require(_sGLMR != address(0), "GLMRRewardCollector.constructor: sGLMR cannot be zero address");
        require(_treasury != address(0), "GLMRRewardCollector.constructor: treasury cannot be zero address");
        require(_treasuryFee <= FEE_DENOMINATOR, "GLMRRewardCollector.constructor: treasuryFee cannot be greater than 100%");
        require(_harvestIncentive <= FEE_DENOMINATOR, "GLMRRewardCollector.constructor: harvestIncentive cannot be greater than 100%");

        glmrDelegator = _glmrDelegator;
        glmrDepositor = _glmrDepositor;
        mGLMR = _mGLMR;
        sGLMR = _sGLMR;
        treasury = _treasury;
        treasuryFee = _treasuryFee;
        harvestIncentive = _harvestIncentive;

        _setupRole(ADMIN_ROLE, msg.sender);

        IMGLMR(_mGLMR).approve(_sGLMR, type(uint256).max);

        emit GLMRDelegatorUpdated(_glmrDelegator);
        emit GLMRDepositorUpdated(_glmrDepositor);
        emit MGLMRUpdated(_mGLMR);
        emit SGLMRUpdated(_sGLMR);
        emit TreasuryUpdated(_treasury);
        emit TreasuryFeeUpdated(_treasuryFee);
        emit HarvestIncentiveUpdated(_harvestIncentive);
    }

    receive() external payable {}

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "GLMRRewardCollector.onlyAdmin: permission denied");
        _;
    }

    modifier onlyRewardDistributor() {
        require(hasRole(REWARD_DISTRIBUTOR_ROLE, msg.sender), "GLMRRewardCollector.onlyRewardDistributor: permission denied");
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

    function updateTreasury(address _newTreasury) external onlyAdmin {
        require(_newTreasury != address(0), "GLMRRewardCollector.updateTreasury:treasury cannot be zero address");
        treasury = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    function updateTreasuryFee(uint256 _newTreasuryFee) external onlyAdmin {
        require(_newTreasuryFee <= FEE_DENOMINATOR, "GLMRRewardCollector.updateTreasuryFee: treasuryFee cannot be greater than 100%");
        treasuryFee = _newTreasuryFee;
        emit TreasuryFeeUpdated(_newTreasuryFee);
    }

    function updateHarvestIncentive(uint256 _newHarvestIncentive) external onlyAdmin {
        harvestIncentive = _newHarvestIncentive;
        emit HarvestIncentiveUpdated(_newHarvestIncentive);
    }

    function distributeReward() external onlyRewardDistributor {
        IGLMRDelegator(glmrDelegator).harvest(address(this));
        if (balances() == 0) {
            return;
        }
        IGLMRDepositor(glmrDepositor).deposit{ value: balances() }(address(this));
        uint256 mGLMRBalance = IMGLMR(mGLMR).balanceOf(address(this));
        if (mGLMRBalance == 0) {
            return;
        }
        
        uint256 treasuryFeeAmount = mGLMRBalance * treasuryFee / FEE_DENOMINATOR;
        uint256 harvestIncentiveAmount = mGLMRBalance * harvestIncentive / FEE_DENOMINATOR;

        if (treasury != address(0) && treasury != address(this) && treasuryFeeAmount > 0) {
           mGLMRBalance -= treasuryFeeAmount;
           IMGLMR(mGLMR).transfer(treasury, treasuryFeeAmount);
           emit TreasuryFeeIssued(treasury, treasuryFeeAmount);
        }

        if (harvestIncentiveAmount > 0) {
            mGLMRBalance -= harvestIncentiveAmount;
            IMGLMR(mGLMR).transfer(msg.sender, harvestIncentiveAmount); 
            emit HarvestIncentiveIssued(msg.sender, harvestIncentiveAmount);
        }

        // distribute rewards to sGLMR
        IMGLMR(mGLMR).transfer(sGLMR, mGLMRBalance);     
        emit RewardsDistributed(sGLMR, mGLMRBalance);
    }
}