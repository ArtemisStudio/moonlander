// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "hardhat/console.sol";

import {IRewarder} from "./interfaces/IRewarder.sol";


// MasterChefLander is a boss. He says "go f your blocks lego boy, I'm gonna use timestamp instead".
// And to top it off, it takes no risks. Because the biggest risk is operator error.
// So we make it virtually impossible for the operator of this contract to cause a bug with people's harvests.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once lander is sufficiently
// distributed and the community can show to govern itself.
//
// With thanks to the Lydia Finance team.
//
// Godspeed and may the 10x be with you.
contract StakingPools is Ownable {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20Metadata;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of landers
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accLanderPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accLanderPerShare` (and `lastRewardTimestamp`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20Metadata lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. landers to distribute per second.
        uint256 lastRewardTimestamp; // Last timestamp that landers distribution occurs.
        uint256 accLanderPerShare; // Accumulated landers per share, times 1e12. See below.
        IRewarder rewarder;
    }

    // The lander TOKEN!
    address public lander;

    uint256 public landerPerSec;

    address public landerRewardSource;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Set of all LP tokens that have been added as pools
    EnumerableSet.AddressSet private lpTokens;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The timestamp when lander mining starts.
    uint256 public startTimestamp;

    // Zapper address
    address public zapperAddress;

    event Add(uint256 indexed pid, uint256 allocPoint, IERC20Metadata indexed lpToken, IRewarder indexed rewarder);
    event Set(uint256 indexed pid, uint256 allocPoint, IRewarder indexed rewarder, bool overwrite);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event UpdatePool(uint256 indexed pid, uint256 lastRewardTimestamp, uint256 lpSupply, uint256 accLanderPerShare);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event SetDevAddress(address indexed oldAddress, address indexed newAddress);
    event UpdateEmissionRate(address indexed user, uint256 _LanderPerSec);
    event UpdateRewardSource(address indexed newRewardSource);


    constructor(
        address _lander,
        uint256 _landerPerSec,
        uint256 _startTimestamp,
        address _landerRewardSource,
        address _zapperAddress
    ) public {
        
        lander = _lander;
        landerPerSec = _landerPerSec;
        startTimestamp = _startTimestamp;
        totalAllocPoint = 0;
        landerRewardSource = _landerRewardSource;
        zapperAddress = _zapperAddress;
    }

    function updateLanderRewardSource(address _newRewardSource) public onlyOwner {
        require(_newRewardSource != address(0), "StakingPools: reward source cannot be zero address");
        landerRewardSource = _newRewardSource;
        emit UpdateRewardSource(_newRewardSource);
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function poolAdded(address _lpToken) public view returns (bool) {
        return lpTokens.contains(address(_lpToken));
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IERC20Metadata _lpToken,
        IRewarder _rewarder
    ) public onlyOwner {
        require(Address.isContract(address(_lpToken)), "add: LP token must be a valid contract");
        require(
            Address.isContract(address(_rewarder)) || address(_rewarder) == address(0),
            "add: rewarder must be contract or zero"
        );
        require(!poolAdded(address(_lpToken)), "add: LP already added");
        massUpdatePools();
        uint256 lastRewardTimestamp = block.timestamp > startTimestamp ? block.timestamp : startTimestamp;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardTimestamp: lastRewardTimestamp,
                accLanderPerShare: 0,
                rewarder: _rewarder
            })
        );
        lpTokens.add(address(_lpToken));
        emit Add(poolInfo.length.sub(1), _allocPoint, _lpToken, _rewarder);
    }

    // Update the given pool's lander allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        IRewarder _rewarder,
        bool overwrite
    ) public onlyOwner {
        require(
            Address.isContract(address(_rewarder)) || address(_rewarder) == address(0),
            "set: rewarder must be contract or zero"
        );
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        if (overwrite) {
            poolInfo[_pid].rewarder = _rewarder;
        }
        emit Set(_pid, _allocPoint, overwrite ? _rewarder : poolInfo[_pid].rewarder, overwrite);
    }

    // View function to see pending landers on frontend.
    function pendingTokens(uint256 _pid, address _user)
        external
        view
        returns (
            uint256 pendingLander,
            address bonusTokenAddress,
            string memory bonusTokenSymbol,
            uint256 pendingBonusToken
        )
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accLanderPerShare = pool.accLanderPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.timestamp > pool.lastRewardTimestamp && lpSupply != 0) {
            uint256 multiplier = block.timestamp.sub(pool.lastRewardTimestamp);
            uint256 landerReward = multiplier.mul(landerPerSec).mul(pool.allocPoint).div(totalAllocPoint);
            accLanderPerShare = accLanderPerShare.add(landerReward.mul(1e12).div(lpSupply));
        }
        pendingLander = user.amount.mul(accLanderPerShare).div(1e12).sub(user.rewardDebt);

        // If it's a double reward farm, we return info about the bonus token
        if (address(pool.rewarder) != address(0)) {
            (bonusTokenAddress, bonusTokenSymbol) = rewarderBonusTokenInfo(_pid);
            pendingBonusToken = pool.rewarder.pendingTokens(_user);
        }
    }

    // Get bonus token info from the rewarder contract for a given pool, if it is a double reward farm
    function rewarderBonusTokenInfo(uint256 _pid)
        public
        view
        returns (address bonusTokenAddress, string memory bonusTokenSymbol)
    {
        PoolInfo storage pool = poolInfo[_pid];
        if (address(pool.rewarder) != address(0)) {
            bonusTokenAddress = address(pool.rewarder.rewardToken());
            bonusTokenSymbol = IERC20Metadata(pool.rewarder.rewardToken()).symbol();
        }
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.timestamp <= pool.lastRewardTimestamp) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardTimestamp = block.timestamp;
            return;
        }
        uint256 multiplier = block.timestamp.sub(pool.lastRewardTimestamp);
        uint256 landerReward = multiplier.mul(landerPerSec).mul(pool.allocPoint).div(totalAllocPoint);
        
        IERC20Metadata(lander).transferFrom( landerRewardSource ,address(this), landerReward);
        pool.accLanderPerShare = pool.accLanderPerShare.add(landerReward.mul(1e12).div(lpSupply));
        pool.lastRewardTimestamp = block.timestamp;
        emit UpdatePool(_pid, pool.lastRewardTimestamp, lpSupply, pool.accLanderPerShare);
    }

    function deposit(uint256 _pid, uint256 _amount) public {
        depositFor(_pid,_amount,msg.sender);
    }

    // Deposit LP tokens to MasterChef for lander allocation.
    function depositFor(uint256 _pid, uint256 _amount, address _for) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_for];
        updatePool(_pid);
        if (user.amount > 0) {
            // Harvest lander
            uint256 pending = user.amount.mul(pool.accLanderPerShare).div(1e12).sub(user.rewardDebt);
            safeLanderTransfer(_for, pending);
            emit Harvest(_for, _pid, pending);
        }
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accLanderPerShare).div(1e12);

        IRewarder rewarder = poolInfo[_pid].rewarder;
        if (address(rewarder) != address(0)) {
            rewarder.onLanderReward(_for, user.amount);
        }

        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(_for, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) public {
        withdrawFor(_pid, _amount, msg.sender);
    }

    // Withdraw LP tokens from MasterChef.
    function withdrawFor(uint256 _pid, uint256 _amount, address _for) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_for];
        require(msg.sender == _for || msg.sender == zapperAddress, "withdraw: must be msg.sender or zapper");
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);

        // Harvest lander
        uint256 pending = user.amount.mul(pool.accLanderPerShare).div(1e12).sub(user.rewardDebt);
        safeLanderTransfer(_for, pending);
        emit Harvest(_for, _pid, pending);

        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accLanderPerShare).div(1e12);

        IRewarder rewarder = poolInfo[_pid].rewarder;
        if (address(rewarder) != address(0)) {
            rewarder.onLanderReward(_for, user.amount);
        }

        pool.lpToken.safeTransfer(address(_for), _amount);
        emit Withdraw(_for, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe lander transfer function, just in case if rounding error causes pool to not have enough landers.
    function safeLanderTransfer(address _to, uint256 _amount) internal {
        uint256 landerBal = IERC20Metadata(lander).balanceOf(address(this));
        if (_amount > landerBal) {
            IERC20Metadata(lander).transfer(_to, landerBal);
        } else {
            IERC20Metadata(lander).transfer(_to, _amount);
        }
    }

    // Pancake has to add hidden dummy pools inorder to alter the emission,
    // here we make it simple and transparent to all.
    function updateEmissionRate(uint256 _landerPerSec) public onlyOwner {
        massUpdatePools();
        landerPerSec = _landerPerSec;
        emit UpdateEmissionRate(msg.sender, _landerPerSec);
    }
}