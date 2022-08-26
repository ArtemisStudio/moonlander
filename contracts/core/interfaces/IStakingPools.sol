pragma solidity ^0.8.0;

interface IStakingPools {
    function depositFor(uint256 _pid, uint256 _amount, address _for) external;
    function withdrawFor(uint256 _pid, uint256 _amount, address _for) external;

}