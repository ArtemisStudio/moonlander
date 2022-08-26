// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MGLMR is AccessControl, ERC20("Moonlander GLMR", "mGLMR") {

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN");
  bytes32 public constant MINTER_ROLE = keccak256("MINTER");

  constructor() {
    _setupRole(ADMIN_ROLE, msg.sender);
    _setupRole(MINTER_ROLE, msg.sender);
    _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
    _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
  }

  modifier onlyMinter() {
    require(hasRole(MINTER_ROLE, msg.sender), "MGLMR: only minter");
    _;
  }

  function mint(address _recipient, uint256 _amount) external onlyMinter {
    _mint(_recipient, _amount);
  }

  function burn(address _from, uint256 _amount) external onlyMinter {
    _burn(_from, _amount);
  }
}