// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./base/TokenSaver.sol";
import "./interfaces/IParachainStaking.sol";
import "./interfaces/IGLMRDelegator.sol";
import "./interfaces/ISGLMR.sol";
import "./interfaces/ITimeLockPool.sol";

contract GLMRDepositor is TokenSaver, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public immutable sGLMR;
    address public glmrDelegator;
    address public sGLMRStaking;
    uint64 public exitDuration;

    uint256 public totalDeposited;
    uint256 public totalScheduled;
    mapping(address => PendingWithdraw[]) public userPendingWithdraws;

    struct PendingWithdraw {
        uint256 amount;
        uint64 start;
        uint64 end;
    }

    event GLMRDelegatorUpdated(address glmrDelegator);
    event SGLMRSet(address sGLMR);
    event SGLMRStakingUpdated(address sGLMRStaking);
    event ExitDurationUpdated(uint64 exitDuration);
    event Deposited(address indexed account, uint256 amount);
    event WithdrawScheduled(address indexed account, uint256 amount, uint64 start, uint64 end);
    event Withdrawn(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);

    constructor(address _glmrDelegator, address _sGLMR, address _sGLMRStaking, uint64 _exitDuration) {
        require(_sGLMR != address(0), "GLMRDepositor.constructor: sGLMR cannot be zero address");
        require(_glmrDelegator != address(0), "GLMRDepositor.constructor: glmrDelegator cannot be zero address");
        require(_sGLMRStaking != address(0), "GLMRDepositor.constructor: sGLMRStaking cannot be zero address");

        sGLMR = _sGLMR;
        glmrDelegator = _glmrDelegator;
        sGLMRStaking = _sGLMRStaking;
        exitDuration = _exitDuration;

        ISGLMR(_sGLMR).approve(_sGLMRStaking, type(uint256).max);

        _setupRole(ADMIN_ROLE, msg.sender);

        emit SGLMRSet(_sGLMR);
        emit GLMRDelegatorUpdated(_glmrDelegator);
        emit SGLMRStakingUpdated(_sGLMRStaking);
        emit ExitDurationUpdated(_exitDuration);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "GLMRDepositor.onlyAdmin: permission denied");
        _;
    }
    
    function updateGLMRDelegator(address _newGLMRDelegator) external onlyAdmin {
        require(_newGLMRDelegator != address(0), "GLMRDepositor.constructor: glmrDelegator cannot be zero address");
        glmrDelegator = _newGLMRDelegator;
        emit GLMRDelegatorUpdated(_newGLMRDelegator);
    }

    function updateSGLMRStaking(address _newSGLMRStaking) external onlyAdmin {
        require(_newSGLMRStaking != address(0), "GLMRDepositor.constructor: sGLMRStaking cannot be zero address");
        ISGLMR(sGLMR).approve(sGLMRStaking, 0);
        sGLMRStaking = _newSGLMRStaking;
        ISGLMR(sGLMR).approve(_newSGLMRStaking, type(uint256).max);
        emit SGLMRStakingUpdated(_newSGLMRStaking);
    }

    function updateExitDuration(uint64 _newExitDuration) external onlyAdmin {
        exitDuration = _newExitDuration;
        emit ExitDurationUpdated(_newExitDuration);
    }

    function delegate(address _candidate, uint256 _amount) external onlyAdmin {
        require(_candidate != address(0), "GLMRDepositor.delegate: candidate cannot be zero address");
        require(balances() >= _amount, "GLMRDepositor.delegate: not enough GLMR");

        (bool success, ) = glmrDelegator.call{value: _amount}("");
		require(success, "GLMRDepositor.delegate: Transfer failed.");

        IGLMRDelegator(glmrDelegator).runDelegate(_candidate, _amount);
    }

    function deposit(address _receiver) payable external nonReentrant {
        require(_receiver != address(0), "GLMRDepositor.deposit: receiver cannot be zero address");
        _deposit(msg.value, _receiver);
    }

    function depositAndStake(address _receiver) payable external nonReentrant {
        require(_receiver != address(0), "GLMRDepositor.depositAndStake: receiver cannot be zero address");
        _deposit(msg.value, address(this));
        ITimeLockPool(sGLMRStaking).deposit(msg.value, 0, _receiver);
    }

    function _deposit(uint256 _amount, address _account) internal {
        require(_amount > 0, "GLMRDepositor._deposit: cannot deposit 0 GLMR");
        require(_account != address(0), "GLMRDepositor._deposit: account cannot be zero address");

        totalDeposited = totalDeposited + _amount;
        ISGLMR(sGLMR).mint(_account, _amount);

        emit Deposited(_account, _amount);
    }

    function scheduleWithdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "GLMRDepositor.scheduleWithdraw: cannot schedule withdraw 0 GLMR");
        uint256 availableSGLMR = ISGLMR(sGLMR).balanceOf(msg.sender);
        require(availableSGLMR >= _amount, "GLMRDepositor.scheduleWithdraw: not enough sGLMR");

        IGLMRDelegator(glmrDelegator).runScheduleWithdraw(_amount);

        ISGLMR(sGLMR).burn(msg.sender, _amount);
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(block.timestamp) + uint64(exitDuration);
        userPendingWithdraws[msg.sender].push(PendingWithdraw({
            amount: _amount,
            start: start,
            end: end
        }));

        totalDeposited -= _amount;
        totalScheduled += _amount;

        emit WithdrawScheduled(msg.sender, _amount, start, end);
    }

    function withdraw(uint256 _pendingGLMRId, address _receiver) external nonReentrant {
        require(_pendingGLMRId < userPendingWithdraws[msg.sender].length, "GLMRDepositor.withdraw: Pending GLMRs does not exist");
        PendingWithdraw memory userPendingWithdraw = userPendingWithdraws[msg.sender][_pendingGLMRId];
        require(block.timestamp >= userPendingWithdraw.end, "GLMRDepositor.withdraw: Too soon");

        uint256 withdrawAmount = userPendingWithdraw.amount;
        userPendingWithdraws[msg.sender][_pendingGLMRId] = userPendingWithdraws[msg.sender][userPendingWithdraws[msg.sender].length - 1];
        userPendingWithdraws[msg.sender].pop();

        IGLMRDelegator(glmrDelegator).runWithdraw(_receiver, withdrawAmount, false);
        
        totalScheduled -= withdrawAmount;

        emit Withdrawn(_pendingGLMRId, _receiver, msg.sender, withdrawAmount);
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

    function availableToDelegate() public view returns(uint256) {
        return balances();
    }
}