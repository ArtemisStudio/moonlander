const { expect } = require("chai");
const { ethers, BigNumber } = require("hardhat");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";


describe("GLMRRewardCollector", function () {
  let owner;
  let player1;

  let MockParachainStakingFactory;
  let MockGLMRDelegatorFactory;
  let GLMRDepositorFactory;
  let MGLMRFactory;
  let GLMRRewardCollectorFactory;

  let parachainStaking;
  let glmrDepositor;
  let glmrDelegator;
  let sGLMR;
  let mGLMR;
  let glmrRewardCollector;
  let treasury;
  let newTreasury;

  const FIRST_EPOCH_NUMBER = 1;
  const EPOCH_DURATION = 28;
  const ROUND_DURATION = 1800;
  const FEE_PERCENTAGE = 50;

  const NEW_FEE = 100;

  before(async () => {
    MockParachainStakingFactory = await ethers.getContractFactory("MockParachainStaking");
    MockGLMRDelegatorFactory = await ethers.getContractFactory("MockGLMRDelegator");
    GLMRDepositorFactory = await ethers.getContractFactory("GLMRDepositor");
    MGLMRFactory = await ethers.getContractFactory("MGLMR");
    GLMRRewardCollectorFactory = await ethers.getContractFactory("GLMRRewardCollector");
  });

  beforeEach(async () => {
    [owner, candidate1, candidate2, candidate3, player1, player2, sGLMR, newGLMRDelegator, newGLMRDepositor, newMGLMR, newSGLMR, treasury, newTreasury] = await ethers.getSigners();

    parachainStaking = await MockParachainStakingFactory.connect(owner).deploy();
    mGLMR = await MGLMRFactory.connect(owner).deploy();
    // sGLMR = await MockSGLMRFactory.connect(owner).deploy(mGLMR.address);
    glmrDelegator = await MockGLMRDelegatorFactory.connect(owner).deploy(parachainStaking.address);
    firstEpochEndBlock = EPOCH_DURATION*ROUND_DURATION
    glmrDepositor = await GLMRDepositorFactory.connect(owner).deploy(glmrDelegator.address, mGLMR.address, sGLMR.address, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock);
    glmrRewardCollector = await GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, mGLMR.address, sGLMR.address, treasury.address, FEE_PERCENTAGE);
    await parachainStaking.connect(owner).setGLMRDelegator(glmrDelegator.address);
    await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.DEPOSITOR_ROLE(), glmrDepositor.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.REWARD_COLLECTOR_ROLE(), glmrRewardCollector.address);
    
    expect(await glmrDepositor.hasRole(await glmrDepositor.ADMIN_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrRewardCollector.mGLMR()).to.be.equal(mGLMR.address);
    expect(await glmrRewardCollector.glmrDelegator()).to.be.equal(glmrDelegator.address);
    expect(await glmrRewardCollector.glmrDepositor()).to.be.equal(glmrDepositor.address);
    expect(await glmrRewardCollector.treasury()).to.be.equal(treasury.address);
    expect(await glmrRewardCollector.sGLMR()).to.be.equal(sGLMR.address);
  });


  describe("Constructor", function() {
    it("Cannot deploy with zero glmrDelegator address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(ZERO_ADDRESS, glmrDepositor.address, mGLMR.address, sGLMR.address, treasury.address, FEE_PERCENTAGE)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: glmrDelegator cannot be zero address"
        );
    });

    it("Cannot deploy with zero glmrDepositor address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, ZERO_ADDRESS, mGLMR.address, sGLMR.address, treasury.address, FEE_PERCENTAGE)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: glmrDepositor cannot be zero address"
        );
    });

    it("Cannot deploy with zero mGLMR address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, ZERO_ADDRESS, sGLMR.address, treasury.address, FEE_PERCENTAGE)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: mGLMR cannot be zero address"
        );
    });

    it("Cannot deploy with zero sGLMR address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, mGLMR.address, ZERO_ADDRESS, treasury.address, FEE_PERCENTAGE)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: sGLMR cannot be zero address"
        );
    });

    it("Cannot deploy with zero treasury address", async function () {
      await expect(GLMRRewardCollectorFactory.connect(owner).deploy(glmrDelegator.address, glmrDepositor.address, mGLMR.address, sGLMR.address, ZERO_ADDRESS, FEE_PERCENTAGE)).to.be.revertedWith(
        "GLMRRewardCollector.constructor: treasury cannot be zero address"
        );
    });
  })

  describe("updateGLMRDelegator", function() {
    it("Cannot updateGLMRDelegator if not admin", async function () {
      await expect(glmrRewardCollector.connect(player1).updateGLMRDelegator(newGLMRDelegator.address)).to.be.revertedWith(
        "GLMRRewardCollector.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateGLMRDelegator to zero address", async function () {
      await expect(glmrRewardCollector.connect(owner).updateGLMRDelegator(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRRewardCollector.updateGLMRDelegator: glmrDelegator cannot be zero address"
      );
    })

    it("Can successfully update GLMRDelegator", async function () {
      expect(await glmrRewardCollector.glmrDelegator()).to.be.equal(glmrDelegator.address);
      await glmrRewardCollector.connect(owner).updateGLMRDelegator(newGLMRDelegator.address);
      expect(await glmrRewardCollector.glmrDelegator()).to.be.equal(newGLMRDelegator.address);
    })

    it("Can emit correct event", async function() {
      await expect(glmrRewardCollector.updateGLMRDelegator(newGLMRDelegator.address))
        .to.emit(glmrRewardCollector, 'GLMRDelegatorUpdated')
        .withArgs(newGLMRDelegator.address);
    });
  })

  describe("updateSGLMR", function() {
    it("Cannot updateSGLMR if not admin", async function () {
      await expect(glmrRewardCollector.connect(player1).updateSGLMR(newSGLMR.address)).to.be.revertedWith(
        "GLMRRewardCollector.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateSGLMR to zero address", async function () {
      await expect(glmrRewardCollector.connect(owner).updateSGLMR(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRRewardCollector.updateSGLMR: sGLMR cannot be zero address"
      );
    })

    it("Can successfully update sGLMR", async function () {
      expect(await glmrRewardCollector.sGLMR()).to.be.equal(sGLMR.address);
      await glmrRewardCollector.connect(owner).updateSGLMR(newSGLMR.address);
      expect(await glmrRewardCollector.sGLMR()).to.be.equal(newSGLMR.address);
    })

    it("Can emit correct event", async function() {
      await expect(glmrRewardCollector.updateSGLMR(newSGLMR.address))
        .to.emit(glmrRewardCollector, 'SGLMRUpdated')
        .withArgs(newSGLMR.address);
    });
  })

  describe("updateTreasury", function() {
    it("Cannot updateTresury if not admin", async function () {
      await expect(glmrRewardCollector.connect(player1).updateTreasury(newTreasury.address)).to.be.revertedWith(
        "GLMRRewardCollector.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateTresury to zero address", async function () {
      await expect(glmrRewardCollector.connect(owner).updateTreasury(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRRewardCollector.updateTreasury:treasury cannot be zero address"
      );
    })

    it("Can successfully update treasury", async function () {
      expect(await glmrRewardCollector.treasury()).to.be.equal(treasury.address);
      await glmrRewardCollector.connect(owner).updateTreasury(newTreasury.address);
      expect(await glmrRewardCollector.treasury()).to.be.equal(newTreasury.address);
    })

    it("Can emit correct event", async function() {
      await expect(glmrRewardCollector.updateTreasury(newTreasury.address))
        .to.emit(glmrRewardCollector, 'TreasuryUpdated')
        .withArgs(newTreasury.address);
    });
  })

  describe("updateTreasuryFee", function() {
    it("Cannot updateTresuryFee if not admin", async function () {
      await expect(glmrRewardCollector.connect(player1).updateTreasuryFee(NEW_FEE)).to.be.revertedWith(
        "GLMRRewardCollector.onlyAdmin: permission denied"
      );
    })

    it("Can successfully update treasury fee", async function () {
      expect(await glmrRewardCollector.feePercantage()).to.be.equal(FEE_PERCENTAGE);
      await glmrRewardCollector.connect(owner).updateTreasuryFee(NEW_FEE);
      expect(await glmrRewardCollector.feePercantage()).to.be.equal(NEW_FEE);
    })

    it("Can emit correct event", async function() {
      await expect(glmrRewardCollector.updateTreasuryFee(NEW_FEE))
        .to.emit(glmrRewardCollector, 'TreasuryFeeUpdated')
        .withArgs(NEW_FEE);
    });
  })

  describe("distributeReward", function() {
    it("cannot distributeReward if not reward distributor", async function() {
      await expect(glmrRewardCollector.connect(player1).distributeReward()).to.be.revertedWith(
        "GLMRRewardCollector.onlyRewardDistributor: permission denied"
        );
    })

    context("with reward distributor role", function() {
      beforeEach(async () => {
        let rewardDistributorRole = await glmrRewardCollector.REWARD_DISTRIBUTOR_ROLE();
        await glmrRewardCollector.connect(owner).grantRole(rewardDistributorRole, player1.address);
      })

      it("can successfully distributeReward", async function() {
        let earnings = "1000";
        await owner.sendTransaction({
          to: glmrRewardCollector.address,
          value: earnings
        });
  
        let beforeBal = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let beforeTreasuryBal = await mGLMR.connect(owner).balanceOf(treasury.address);
  
  
        await glmrRewardCollector.connect(player1).distributeReward();
        let afterBal = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let afterBalTreasury = await mGLMR.connect(owner).balanceOf(treasury.address);
  
  
        expect(afterBal.sub(beforeBal)).to.be.equal(995);
        expect(await glmrDepositor.connect(owner).totalDeposited()).to.be.equal(1000);
  
        expect(afterBalTreasury.sub(beforeTreasuryBal)).to.be.equal(5);
      })
  
      it("can successfully distributeReward after change fee percentage", async function() {
        let earnings = "1000";
        await owner.sendTransaction({
          to: glmrRewardCollector.address,
          value: earnings
        });
  
        let beforeBal = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let beforeTreasuryBal = await mGLMR.connect(owner).balanceOf(treasury.address);
  
        await glmrRewardCollector.connect(player1).distributeReward();
        let afterBal = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let afterBalTreasury = await mGLMR.connect(owner).balanceOf(treasury.address);
  
  
        expect(afterBal.sub(beforeBal)).to.be.equal(995);
        expect(await glmrDepositor.connect(owner).totalDeposited()).to.be.equal(1000);
  
        expect(afterBalTreasury.sub(beforeTreasuryBal)).to.be.equal(5);
  
        await glmrRewardCollector.connect(owner).updateTreasuryFee(100);
  
        let earnings2 = "1000";
        await owner.sendTransaction({
          to: glmrRewardCollector.address,
          value: earnings2
        });
  
        let beforeBal2 = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let beforeTreasuryBal2 = await mGLMR.connect(owner).balanceOf(treasury.address);
  
  
        await glmrRewardCollector.connect(player1).distributeReward();
        let afterBal2 = await mGLMR.connect(owner).balanceOf(sGLMR.address);
        let afterBalTreasury2 = await mGLMR.connect(owner).balanceOf(treasury.address);
  
  
        expect(afterBal2.sub(beforeBal2)).to.be.equal(990);
        expect(await glmrDepositor.connect(owner).totalDeposited()).to.be.equal(2000);
  
        expect(afterBalTreasury2.sub(beforeTreasuryBal2)).to.be.equal(10);
      })
    })
  })
});