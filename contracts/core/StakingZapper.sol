pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;


import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

import {IERC4626} from "./interfaces/IERC4626.sol";
import {IStakingPools} from "./interfaces/IStakingPools.sol";

// mglmr deposit -> sglmr (deposit)

// mglmr deposit -> sglmr -> stake to stakingpool

// sglmr withdraw -> mglmr (withdraw)

// staking pool unstake -> sglmr withdraw -> mglmr 

contract StakingZapper is  Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public immutable sToken;
    IStakingPools public stakingPools;
    uint256 public pid;
    bool public isInitiated;

    constructor(
        address _sToken
    ) public {
        require(Address.isContract(address(_sToken)), "constructor: sToken must be a valid contract");
        sToken = _sToken;
        IERC20(IERC4626(sToken).asset()).approve(address(sToken),type(uint256).max); // approve mGLMR to sGLMR
        
    }

    function initiate(IStakingPools _stakingPools, uint256 _pid) public onlyOwner {
        require(Address.isContract(address(_stakingPools)), "StakingZapper: stakingPools must be a valid contract");
        require(!isInitiated, "StakingZapper: can not initiate twice");
        stakingPools = _stakingPools;
        pid = _pid;
        IERC20(sToken).approve(address(stakingPools),type(uint256).max); // approve sGLMR to stakingPools
        isInitiated = true;
        
    }

    function directDeposit(uint256 _amount) external nonReentrant{
        require(_amount > 0, "StakingZapper: deposit amount must be greater than zero");
        IERC20(IERC4626(sToken).asset()).transferFrom(msg.sender, address(this), _amount); 
        IERC4626(sToken).deposit(_amount, msg.sender);
    }

    function directStake(uint256 _amount) external nonReentrant{
        require(_amount > 0, "StakingZapper: stake amount must be greater than zero");
        IERC20(sToken).transferFrom(msg.sender, address(this), _amount); 
        stakingPools.depositFor(pid, _amount, msg.sender);
    }

    function depositAndStake(uint256 _amount) external {
        depositAndStakeFor(_amount,msg.sender);
    }

    function depositAndStakeFor(uint256 _amount, address _for) public nonReentrant{
        require(_amount > 0, "StakingZapper: depositAndStake amount must be greater than zero");
        IERC20(IERC4626(sToken).asset()).transferFrom(msg.sender, address(this), _amount); // transfer mGLMR to this address
        uint256 getShare = IERC4626(sToken).deposit(_amount, address(this)); // deposit mGLMR to sGLMR, and get sGLMR here
        stakingPools.depositFor(pid, getShare, _for); // stake sGLMR for msg.sender
    }

}