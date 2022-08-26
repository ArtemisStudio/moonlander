// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../base/TokenSaver.sol";
import "./interfaces/IParachainStaking.sol";
import "./interfaces/IGLMRDelegator.sol";
import "./interfaces/IMGLMR.sol";
import "hardhat/console.sol";


interface IStakingZapper {

    function depositAndStakeFor(uint256 _amount, address _for) external;

}

contract GLMRDepositor is TokenSaver, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public immutable mGLMR;
    address payable public glmrDelegator;
    address public mGLMRStakingZapper;

    uint256 public totalDeposited;
    uint256 public totalScheduled;
    mapping(address => PendingWithdraw[]) public userPendingWithdraws;
    mapping(address => PendingWithdraw[]) public adminPendingWithdraws;

    uint256 public constant EXIT_EPOCH_DURATION = 2;
    uint256 public immutable roundDuration;

    Epoch public epoch;

    struct Epoch {
        uint256 duration; // in rounds
        uint256 number; // since inception
        uint256 end; // in block number
        uint256 userPending; // amount
        uint256 adminPending;
    }

    struct PendingWithdraw {
        uint256 amount;
        uint256 unlockEpoch;
    }

    event MGLMRSet(address mGLMR);
    event RoundDurationSet(uint256 roundDuration);
    event GLMRDelegatorUpdated(address glmrDelegator);
    event MGLMRStakingZapperUpdated(address mGLMRStakingZapper);
    event EpochDurationUpdated(uint256 epochDuration);

    event Deposited(address indexed account, uint256 amount, bool staked);
    event WithdrawScheduled(address indexed account, uint256 amount, uint256 epoch);
    event AdminWithdrawScheduled(address indexed account, uint256 amount, uint256 epoch);
    event Withdrawn(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);
    event AdminRedelegated(uint256 indexed depositId, address indexed candidate, address indexed from, uint256 amount);
    event Delegated(address indexed candidate, uint256 amount);

    constructor(
        address payable _glmrDelegator, 
        address _mGLMR, 
        address _mGLMRStakingZapper,
        uint256 _roundDuration,
        uint256 _epochDuration,
        uint256 _firstEpochNumber,
        uint256 _firstEpochEndBlock) {
        require(_mGLMR != address(0), "GLMRDepositor.constructor: mGLMR cannot be zero address");
        require(_glmrDelegator != address(0), "GLMRDepositor.constructor: glmrDelegator cannot be zero address");
        require(_mGLMRStakingZapper != address(0), "GLMRDepositor.constructor: mGLMRStakingZapper cannot be zero address");
        require(_roundDuration > 0, "GLMRDepositor.constructor: round duration should be greater than zero");
        require(_epochDuration > 0, "GLMRDepositor.constructor: epoch duration should be greater than zero");
        require(_firstEpochEndBlock > 0, "GLMRDepositor.constructor: first epoch end block should be greater than zero");

        mGLMR = _mGLMR;
        glmrDelegator = _glmrDelegator;
        mGLMRStakingZapper = _mGLMRStakingZapper;
        roundDuration = _roundDuration;

        IMGLMR(_mGLMR).approve(_mGLMRStakingZapper, type(uint256).max);

        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);

        epoch = Epoch({duration: _epochDuration, number: _firstEpochNumber, end: _firstEpochEndBlock, userPending: 0, adminPending: 0});

        emit MGLMRSet(_mGLMR);
        emit RoundDurationSet(_roundDuration);
        emit GLMRDelegatorUpdated(_glmrDelegator);
        emit MGLMRStakingZapperUpdated(_mGLMRStakingZapper);
        emit EpochDurationUpdated(_epochDuration);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "GLMRDepositor.onlyAdmin: permission denied");
        _;
    }

    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "GLMRDepositor.onlyOperator: permission denied");
        _;
    }
    
    function updateGLMRDelegator(address payable _newGLMRDelegator) external onlyAdmin {
        require(_newGLMRDelegator != address(0), "GLMRDepositor.updateGLMRDelegator: glmrDelegator cannot be zero address");
        glmrDelegator = _newGLMRDelegator;
        emit GLMRDelegatorUpdated(_newGLMRDelegator);
    }

    function updateMGLMRStakingZapper(address _newMGLMRStakingZapper) external onlyAdmin {
        require(_newMGLMRStakingZapper != address(0), "GLMRDepositor.updateMGLMRStakingZapper: mGLMRStakingZapper cannot be zero address");
        IMGLMR(mGLMR).approve(mGLMRStakingZapper, 0);
        mGLMRStakingZapper = _newMGLMRStakingZapper;
        IMGLMR(mGLMR).approve(_newMGLMRStakingZapper, type(uint256).max);
        emit MGLMRStakingZapperUpdated(_newMGLMRStakingZapper);
    }

    function updateEpochDuration(uint256 _newEpochDuration) external onlyAdmin {
        require(_newEpochDuration > 0, "GLMRDepositor.updateEpochDuration: epoch duration should be greater than zero");
        epoch.duration = _newEpochDuration;
        emit EpochDurationUpdated(_newEpochDuration);
    }

    function delegate(address _candidate, uint256 _amount) external nonReentrant onlyOperator {
        require(_candidate != address(0), "GLMRDepositor.delegate: candidate cannot be zero address");
        require(_amount > 0,  "GLMRDepositor.delegate: amount cannot be zero");
        require(balances() >= _amount, "GLMRDepositor.delegate: not enough GLMR");

        glmrDelegator.transfer(_amount);
        IGLMRDelegator(glmrDelegator).runDelegate(_candidate, _amount);
        emit Delegated(_candidate, _amount);
    }

    function deposit(address _receiver) payable external nonReentrant {
        require(_receiver != address(0), "GLMRDepositor.deposit: receiver cannot be zero address");
        _deposit(msg.value, _receiver);
        emit Deposited(_receiver, msg.value, false);
    }

    function depositAndStake(address _receiver) payable external nonReentrant {
        require(_receiver != address(0), "GLMRDepositor.depositAndStake: receiver cannot be zero address");
        _deposit(msg.value, address(this));
        //stake to mGLMRStakingZapperPool
        IStakingZapper(mGLMRStakingZapper).depositAndStakeFor(msg.value, _receiver);

        emit Deposited(_receiver, msg.value, true);
    }

    function _deposit(uint256 _amount, address _account) internal {
        require(_amount > 0, "GLMRDepositor._deposit: cannot deposit 0 GLMR");
        require(_account != address(0), "GLMRDepositor._deposit: account cannot be zero address");

        totalDeposited += _amount;
        IMGLMR(mGLMR).mint(_account, _amount);
    }

    function scheduleWithdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "GLMRDepositor.scheduleWithdraw: cannot schedule withdraw 0 GLMR");
        uint256 availableMGLMR = IMGLMR(mGLMR).balanceOf(msg.sender);
        require(availableMGLMR >= _amount, "GLMRDepositor.scheduleWithdraw: not enough mGLMR");

        IMGLMR(mGLMR).burn(msg.sender, _amount);
        uint256 unlockEpoch = epoch.number + EXIT_EPOCH_DURATION;
        userPendingWithdraws[msg.sender].push(PendingWithdraw({
            amount: _amount,
            unlockEpoch: unlockEpoch
        }));

        epoch.userPending += _amount;

        emit WithdrawScheduled(msg.sender, _amount, epoch.number);
    }

    function withdraw(uint256 _pendingWithdrawId, address _receiver) external nonReentrant {
        require(_pendingWithdrawId < userPendingWithdraws[msg.sender].length, "GLMRDepositor.withdraw: Pending GLMRs does not exist");
        PendingWithdraw memory userPendingWithdraw = userPendingWithdraws[msg.sender][_pendingWithdrawId];
        require(epoch.number >= userPendingWithdraw.unlockEpoch, "GLMRDepositor.withdraw: Too soon");

        uint256 withdrawAmount = userPendingWithdraw.amount;
        userPendingWithdraws[msg.sender][_pendingWithdrawId] = userPendingWithdraws[msg.sender][userPendingWithdraws[msg.sender].length - 1];
        userPendingWithdraws[msg.sender].pop();

        IGLMRDelegator(glmrDelegator).runWithdraw(_receiver, withdrawAmount, false);

        totalScheduled -= withdrawAmount;
        totalDeposited -= withdrawAmount;

        emit Withdrawn(_pendingWithdrawId, _receiver, msg.sender, withdrawAmount);
    }

    function adminScheduleWithdraw(uint256 _amount) external nonReentrant onlyAdmin {
        require(_amount > 0, "GLMRDepositor.adminScheduleWithdraw: cannot schedule withdraw 0 GLMR");
        uint256 totalAvailableAmount = totalDeposited - totalScheduled - totalPending();
        require(totalAvailableAmount >= _amount, "GLMRDepositor.adminScheduleWithdraw: not enough GLMR");

        uint256 unlockEpoch = epoch.number + EXIT_EPOCH_DURATION;
        adminPendingWithdraws[msg.sender].push(PendingWithdraw({
            amount: _amount,
            unlockEpoch: unlockEpoch
        }));

        epoch.adminPending += _amount;

        emit AdminWithdrawScheduled(msg.sender, _amount, epoch.number);
    }

    function adminRedelegate(uint256 _pendingWithdrawId, address _candidate) external nonReentrant onlyAdmin {
        require(_pendingWithdrawId < adminPendingWithdraws[msg.sender].length, "GLMRDepositor.adminRedelegate: Pending GLMRs does not exist");
        PendingWithdraw memory adminPendingWithdraw = adminPendingWithdraws[msg.sender][_pendingWithdrawId];
        require(epoch.number >= adminPendingWithdraw.unlockEpoch, "GLMRDepositor.adminRedelegate: Too soon");

        uint256 redelegateAmount = adminPendingWithdraw.amount;
        adminPendingWithdraws[msg.sender][_pendingWithdrawId] = adminPendingWithdraws[msg.sender][adminPendingWithdraws[msg.sender].length - 1];
        adminPendingWithdraws[msg.sender].pop();

        IGLMRDelegator(glmrDelegator).runWithdraw(_candidate, redelegateAmount, true);

        totalScheduled -= redelegateAmount;

        emit AdminRedelegated(_pendingWithdrawId, _candidate, msg.sender, redelegateAmount);
    }

    function advanceEpoch(address[] memory _candidates, uint256[] memory _amounts) external nonReentrant onlyOperator {
        require(_candidates.length == _amounts.length, "GLMRDepositor.advanceEpoch: candidates and amounts length mismatch");
        require(epoch.end < block.number, "GLMRDepositor.advanceEpoch: too soon");

        IGLMRDelegator(glmrDelegator).runExecuteAllDelegationRequests();
        uint256 remainingPending = epoch.userPending + epoch.adminPending;
        for (uint i=0; i<_candidates.length; i++) {
            address candidate = _candidates[i];
            uint256 amount = _amounts[i];
            require(candidate != address(0), "GLMRDepositor.advanceEpoch: candidate cannot be zero address");
            require(amount > 0, "GLMRDepositor.advanceEpoch: amount cannot be zero");

            if (remainingPending >= amount) {
                IGLMRDelegator(glmrDelegator).runSingleScheduleWithdraw(candidate, amount);
                remainingPending -= amount;
            } else {
                IGLMRDelegator(glmrDelegator).runSingleScheduleWithdraw(candidate, remainingPending);
                remainingPending = 0;
            }
        }

        require(remainingPending == 0, "GLMRDepositor.advanceEpoch: remaining pending withdraw should be zero");

        epoch.end = block.number + (epoch.duration * roundDuration);
        epoch.number++;
        totalScheduled += epoch.userPending + epoch.adminPending;
        epoch.userPending = 0;
        epoch.adminPending = 0;
    }

    function balances() public view returns(uint256) {
        return address(this).balance;
    }

    function availableToDelegate() external view returns(uint256) {
        return balances();
    }

    function getUserPendingWithdraws(address _account) external view returns(PendingWithdraw[] memory) {
        return userPendingWithdraws[_account];
    }

    function getUserPendingWithdrawsLength(address _account) external view returns(uint256) {
        return userPendingWithdraws[_account].length;
    }

    function getAdminPendingWithdraws(address _account) external view returns(PendingWithdraw[] memory) {
        return adminPendingWithdraws[_account];
    }

    function getAdminPendingWithdrawsLength(address _account) external view returns(uint256) {
        return adminPendingWithdraws[_account].length;
    }

    function secondsToNextEpoch() external view returns (uint256) {
        return epoch.end - block.timestamp;
    }
    
    function currentEpoch() external view returns (uint256) {
        return epoch.number;
    }
    
    function totalPending() public view returns (uint256) {
        return epoch.userPending + epoch.adminPending;
    }
}