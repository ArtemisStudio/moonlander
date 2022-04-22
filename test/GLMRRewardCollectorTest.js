const { expect } = require("chai");
const { ethers } = require("hardhat");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("GLMRRewardCollector", function () {
  let owner;
  let player1;

  let MockParachainStakingFactory;
  let MockGLMRDelegatorFactory;
  let GLMRDepositorFactory;
  let MockSGLMRStakingFactory;
  let SGLMRFactory;
  let GLMRRewardCollectorFactory;

  let parachainStaking;
  let glmrDepositor;
  let glmrDelegator;
  let sGLMRStaking;
  let sGLMR;
  let glmrRewardCollector;

  let EXIT_DURATION = 600;
  let MIN_DELEGATION = "5000000000000000000";

  before(async () => {
    MockParachainStakingFactory = await ethers.getContractFactory("MockParachainStaking");
    MockGLMRDelegatorFactory = await ethers.getContractFactory("MockGLMRDelegator");
    GLMRDepositorFactory = await ethers.getContractFactory("GLMRDepositor");
    MockSGLMRStakingFactory = await ethers.getContractFactory("MockSGLMRStaking");
    SGLMRFactory = await ethers.getContractFactory("SGLMR");
    GLMRRewardCollectorFactory = await ethers.getContractFactory("GLMRRewardCollector");
  });

  beforeEach(async () => {
    [owner, candidate1, candidate2, candidate3, player1, player2] = await ethers.getSigners();

    parachainStaking = await MockParachainStakingFactory.connect(owner).deploy();
    sGLMR = await SGLMRFactory.connect(owner).deploy();
    sGLMRStaking = await MockSGLMRStakingFactory.connect(owner).deploy(sGLMR.address);
    glmrDelegator = await MockGLMRDelegatorFactory.connect(owner).deploy(parachainStaking.address);
    glmrDepositor = await GLMRDepositorFactory.connect(owner).deploy(glmrDelegator.address, sGLMR.address, sGLMRStaking.address, EXIT_DURATION);
    glmrRewardCollector = await GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, sGLMR.address, sGLMRStaking.address);
    await parachainStaking.connect(owner).setGLMRDelegator(glmrDelegator.address);
    await sGLMR.connect(owner).grantRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.DEPOSITOR_ROLE(), glmrDepositor.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.REWARD_COLLECTOR_ROLE(), glmrRewardCollector.address);

    expect(await glmrDepositor.hasRole(await glmrDepositor.ADMIN_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrRewardCollector.sGLMR()).to.be.equal(sGLMR.address);
    expect(await glmrRewardCollector.glmrDelegator()).to.be.equal(glmrDelegator.address);
    expect(await glmrRewardCollector.glmrDepositor()).to.be.equal(glmrDepositor.address);
    expect(await glmrRewardCollector.sGLMRStakingPool()).to.be.equal(sGLMRStaking.address);
  });


  describe("Constructor", function() {
    it("Cannot deploy with zero glmrDelegator address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(ZERO_ADDRESS, glmrDepositor.address, sGLMR.address, sGLMRStaking.address)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: glmrDelegator cannot be zero address"
        );
    });

    it("Cannot deploy with zero glmrDepositor address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, ZERO_ADDRESS, sGLMR.address, sGLMRStaking.address)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: glmrDepositor cannot be zero address"
        );
    });

    it("Cannot deploy with zero sGLMR address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, ZERO_ADDRESS, sGLMRStaking.address)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: sGLMR cannot be zero address"
        );
    });

    it("Cannot deploy with zero sGLMRStakingPool address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, sGLMR.address, ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: sGLMRStakingPool cannot be zero address"
        );
    });
  })

  describe("distributeReward", function() {
    it("cannot distributeReward if not admin", async function() {
      await expect(glmrRewardCollector.connect(player1).distributeReward()).to.be.revertedWith(
        "GLMRRewardCollector.onlyAdmin: permission denied"
        );
    })

    it("can successfully distributeReward", async function() {
      let earnings = ethers.utils.parseEther("1.0");
      await owner.sendTransaction({
        to: glmrRewardCollector.address,
        value: earnings
      });

      let beforeBal = await sGLMR.connect(owner).balanceOf(sGLMRStaking.address);
      await glmrRewardCollector.connect(owner).distributeReward();
      let afterBal = await sGLMR.connect(owner).balanceOf(sGLMRStaking.address);
      expect(afterBal.sub(beforeBal)).to.be.equal(earnings);
      expect(await glmrDepositor.connect(owner).totalDeposited()).to.be.equal(earnings);
    })
  })
});