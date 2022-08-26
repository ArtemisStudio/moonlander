const { expect } = require("chai");
const { ethers } = require("hardhat");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const { advanceTimeAndBlock, advanceBlockTo, latest, duration, increase } = require("./utilities/time");

describe("GLMRDepositor", function () {
  let owner;
  let candidate1;
  let candidate2;
  let candidate3;
  let player1;
  let player2;
  let newGLMRDelegator;
  let newMGLMRStakingZapper;
  let landerSource;

  let MockParachainStakingFactory;
  let MockGLMRDelegatorFactory;
  let GLMRDepositorFactory;
  let MGLMRFactory;
  
  let MasterChefV2Factory;
  let ZapperFactory;
  let SGLMRFactory;
  let MockERC20Factory;

  let parachainStaking;
  let glmrDepositor;
  let glmrDelegator;
  let mGLMRStakingZapper;
  let mGLMR;
  let sGLMR;
  let mcv2;
  let lander;

  const FIRST_EPOCH_NUMBER = 1;
  const EPOCH_DURATION = 28;
  const ROUND_DURATION = 1800;
  const BLOCKS_PER_EPOCH_HEX = "0xC4E0"; //28*1800

  let firstEpochEndBlock;

  before(async () => {
    MockParachainStakingFactory = await ethers.getContractFactory("MockParachainStaking");
    MockGLMRDelegatorFactory = await ethers.getContractFactory("MockGLMRDelegator");
    GLMRDepositorFactory = await ethers.getContractFactory("GLMRDepositor");
    MGLMRFactory = await ethers.getContractFactory("MGLMR");
  });

  beforeEach(async () => {
    [owner, candidate1, candidate2, candidate3, player1, player2, newGLMRDelegator, mGLMRStakingZapper, newMGLMRStakingZapper, landerSource] = await ethers.getSigners();

    parachainStaking = await MockParachainStakingFactory.connect(owner).deploy();
    mGLMR = await MGLMRFactory.connect(owner).deploy();

    // mGLMRStakingZapper = await MockMGLMRStakingZapperFactory.connect(owner).deploy(mGLMR.address);
    glmrDelegator = await MockGLMRDelegatorFactory.connect(owner).deploy(parachainStaking.address);
    firstEpochEndBlock = EPOCH_DURATION*ROUND_DURATION
    glmrDepositor = await GLMRDepositorFactory.connect(owner).deploy(glmrDelegator.address, mGLMR.address, mGLMRStakingZapper.address, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock);
    await parachainStaking.connect(owner).setGLMRDelegator(glmrDelegator.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.DEPOSITOR_ROLE(), glmrDepositor.address);

    expect(await glmrDepositor.hasRole(await glmrDepositor.ADMIN_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrDepositor.hasRole(await glmrDepositor.OPERATOR_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrDepositor.mGLMR()).to.be.equal(mGLMR.address);
    expect(await glmrDepositor.mGLMRStakingZapper()).to.be.equal(mGLMRStakingZapper.address);
    expect(await glmrDepositor.glmrDelegator()).to.be.equal(glmrDelegator.address);

    let epoch = await glmrDepositor.epoch();
    expect(epoch.number).to.be.equal(FIRST_EPOCH_NUMBER);
    expect(epoch.duration).to.be.equal(EPOCH_DURATION);
    expect(epoch.end).to.be.equal(firstEpochEndBlock);
    expect(epoch.userPending).to.be.equal(0);
    expect(epoch.adminPending).to.be.equal(0);
  });

  describe("Constructor", function() {
    it("Cannot deploy with zero glmrDelegator address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(ZERO_ADDRESS, mGLMR.address, mGLMRStakingZapper.address, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock)).to.be.revertedWith(
        "GLMRDepositor.constructor: glmrDelegator cannot be zero address"
        );
    });

    it("Cannot deploy with zero mGLMR address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, ZERO_ADDRESS, mGLMRStakingZapper.address, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock)).to.be.revertedWith(
        "GLMRDepositor.constructor: mGLMR cannot be zero address"
        );
    });

    it("Cannot deploy with zero mGLMRStakingZapper address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, mGLMR.address, ZERO_ADDRESS, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock)).to.be.revertedWith(
        "GLMRDepositor.constructor: mGLMRStakingZapper cannot be zero address"
        );
    });

    it("Cannot deploy with zero round duration", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, mGLMR.address, mGLMRStakingZapper.address, 0, EPOCH_DURATION, FIRST_EPOCH_NUMBER, firstEpochEndBlock)).to.be.revertedWith(
        "GLMRDepositor.constructor: round duration should be greater than zero"
        );
    });

    it("Cannot deploy with zero epoch duration", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, mGLMR.address, mGLMRStakingZapper.address, ROUND_DURATION, 0, FIRST_EPOCH_NUMBER, firstEpochEndBlock)).to.be.revertedWith(
        "GLMRDepositor.constructor: epoch duration should be greater than zero"
        );
    });

    it("Cannot deploy with zero firstEpochEndBlock duration", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, mGLMR.address, mGLMRStakingZapper.address, ROUND_DURATION, EPOCH_DURATION, FIRST_EPOCH_NUMBER, 0)).to.be.revertedWith(
        "GLMRDepositor.constructor: first epoch end block should be greater than zero"
        );
    });
  })

  describe("updateGLMRDelegator", function() {
    it("Cannot updateGLMRDelegator if not admin", async function () {
      await expect(glmrDepositor.connect(player1).updateGLMRDelegator(newGLMRDelegator.address)).to.be.revertedWith(
        "GLMRDepositor.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateGLMRDelegator to zero address", async function () {
      await expect(glmrDepositor.connect(owner).updateGLMRDelegator(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRDepositor.updateGLMRDelegator: glmrDelegator cannot be zero address"
      );
    })

    it("Can successfully update GLMRDelegator", async function () {
      expect(await glmrDepositor.glmrDelegator()).to.be.equal(glmrDelegator.address);
      await glmrDepositor.connect(owner).updateGLMRDelegator(newGLMRDelegator.address);
      expect(await glmrDepositor.glmrDelegator()).to.be.equal(newGLMRDelegator.address);
    })

    it("Can emit correct event", async function() {
      await expect(glmrDepositor.updateGLMRDelegator(newGLMRDelegator.address))
        .to.emit(glmrDepositor, 'GLMRDelegatorUpdated')
        .withArgs(newGLMRDelegator.address);
    });
  })

  describe("updateMGLMRStakingZapper", function() {
    it("Cannot updateMGLMRStakingZapper if not admin", async function () {
      await expect(glmrDepositor.connect(player1).updateMGLMRStakingZapper(newMGLMRStakingZapper.address)).to.be.revertedWith(
        "GLMRDepositor.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateMGLMRStakingZapper to zero address", async function () {
      await expect(glmrDepositor.connect(owner).updateMGLMRStakingZapper(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRDepositor.updateMGLMRStakingZapper: mGLMRStakingZapper cannot be zero address"
      );
    })

    it("Can successfully update mGLMRStakingZapper", async function () {
      expect(await glmrDepositor.mGLMRStakingZapper()).to.be.equal(mGLMRStakingZapper.address);
      await glmrDepositor.connect(owner).updateMGLMRStakingZapper(newMGLMRStakingZapper.address);
      expect(await glmrDepositor.mGLMRStakingZapper()).to.be.equal(newMGLMRStakingZapper.address);
    })

    it("Can emit correct event", async function() {
      await expect(glmrDepositor.updateMGLMRStakingZapper(newMGLMRStakingZapper.address))
        .to.emit(glmrDepositor, 'MGLMRStakingZapperUpdated')
        .withArgs(newMGLMRStakingZapper.address);
    });
  })

  describe("updateEpochDuration", function() {
    it("Cannot updateEpochDuration if not admin", async function () {
      let newEpochDuration = 200;
      await expect(glmrDepositor.connect(player1).updateEpochDuration(newEpochDuration)).to.be.revertedWith(
        "GLMRDepositor.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateEpochDuration to zero", async function () {
      await expect(glmrDepositor.connect(owner).updateEpochDuration(0)).to.be.revertedWith(
        "GLMRDepositor.updateEpochDuration: epoch duration should be greater than zero"
      );
    })

    it("Can successfully update epochDuration", async function () {
      let newEpochDuration = 200;

      let epoch = await glmrDepositor.epoch();
      expect(epoch.duration).to.be.equal(EPOCH_DURATION);

      await glmrDepositor.connect(owner).updateEpochDuration(newEpochDuration);

      let updatedEpoch = await glmrDepositor.epoch();
      expect(updatedEpoch.duration).to.be.equal(newEpochDuration);
    })

    it("Can emit correct event", async function() {
      let newEpochDuration = 200;

      await expect(glmrDepositor.updateEpochDuration(newEpochDuration))
        .to.emit(glmrDepositor, 'EpochDurationUpdated')
        .withArgs(newEpochDuration);
    });
  })

  describe("Deposit", function() {
    context("No minter role", function() {
      it("Cannot deposit if GLMRDepositor doesn't have minter role of mGLMR", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).deposit(player1.address, overrides)).to.be.revertedWith(
          "MGLMR: only minter"
        );
      })
    })
  
    context("Has minter role", function() {
      beforeEach(async () => {
        await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);
      });

      it("Cannot deposit 0 amount", async function () {
        await expect(glmrDepositor.connect(player1).deposit(player1.address)).to.be.revertedWith(
          "GLMRDepositor._deposit: cannot deposit 0 GLMR"
        );
      });

      it("Cannot deposit for zero address", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).deposit(ZERO_ADDRESS, overrides)).to.be.revertedWith(
          "GLMRDepositor.deposit: receiver cannot be zero address"
        );
      });

      it("Can successfully deposit for self", async function () {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(0);

        await glmrDepositor.connect(player1).deposit(player1.address, overrides);

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.totalDeposited()).to.be.equal("1000000000000000000");
        expect(await mGLMR.balanceOf(player1.address)).to.be.equal("1000000000000000000");
      });

      it("Can successfully deposit for others", async function () {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(0);

        await glmrDepositor.connect(player1).deposit(player2.address, overrides);

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.totalDeposited()).to.be.equal("1000000000000000000");
        expect(await mGLMR.balanceOf(player2.address)).to.be.equal("1000000000000000000");
      });

      it("Can emit correct event", async function() {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        await expect(glmrDepositor.connect(player1).deposit(player1.address, overrides))
          .to.emit(glmrDepositor, "Deposited")
          .withArgs(player1.address, ethers.utils.parseEther("1.0"), false);
      });
    })
  })

  describe("Deposit And Stake", function() {

    before(async () => {
      MasterChefV2Factory = await ethers.getContractFactory("StakingPools");
      ZapperFactory = await ethers.getContractFactory("StakingZapper");
      SGLMRFactory = await ethers.getContractFactory("SGLMR");
      MockERC20Factory = await ethers.getContractFactory("MockERC20");
    });

    beforeEach(async () => {
      lander = await MockERC20Factory.connect(owner).deploy("Lander Token", "LANDER");

      sGLMR = await SGLMRFactory.connect(owner).deploy(mGLMR.address,"Staked Moon GLMR","sGLMR");

      mGLMRStakingZapper = await ZapperFactory.connect(owner).deploy(sGLMR.address);

      const startTime = (await latest()).add(60)

      mcv2 = await MasterChefV2Factory.connect(owner).deploy(
        lander.address,
        100,
        startTime,
        landerSource.address,
        mGLMRStakingZapper.address
     )

     await mcv2.connect(owner).add("100",sGLMR.address,ZERO_ADDRESS);

     await mGLMRStakingZapper.connect(owner).initiate(mcv2.address,0);

     await glmrDepositor.connect(owner).updateMGLMRStakingZapper(mGLMRStakingZapper.address);
      
    });

    context("No minter role", function() {
      it("Cannot deposit and stake if GLMRDepositor doesn't have minter role of mGLMR", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).depositAndStake(player1.address, overrides)).to.be.revertedWith(
          "MGLMR: only minter"
        );
      })
    })
  
    context("Has minter role", function() {
      beforeEach(async () => {
        await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);
      });

      it("Cannot deposit and stake 0 amount", async function () {
        await expect(glmrDepositor.connect(player1).depositAndStake(player1.address)).to.be.revertedWith(
          "GLMRDepositor._deposit: cannot deposit 0 GLMR"
        );
      });

      it("Cannot deposit and stake for zero address", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).depositAndStake(ZERO_ADDRESS, overrides)).to.be.revertedWith(
          "GLMRDepositor.depositAndStake: receiver cannot be zero address"
        );
      });

      it("Can successfully deposit and stake for self", async function () {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(0);

        await glmrDepositor.connect(player1).depositAndStake(player1.address, overrides);

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.balances()).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.totalDeposited()).to.be.equal("1000000000000000000");
        expect(await mGLMR.balanceOf(player1.address)).to.be.equal("0");
        expect(await sGLMR.balanceOf(mcv2.address)).to.be.equal("1000000000000000000");
        expect(await sGLMR.balanceOf(player1.address)).to.be.equal("0");

        console.log(await mcv2.userInfo(0,player1.address));
        
      });

      it("Can successfully deposit and stake for others", async function () {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(0);

        await glmrDepositor.connect(player1).depositAndStake(player2.address, overrides);

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.balances()).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.totalDeposited()).to.be.equal("1000000000000000000");
        expect(await mGLMR.balanceOf(player2.address)).to.be.equal("0");
        expect(await mGLMR.balanceOf(mGLMRStakingZapper.address)).to.be.equal("0");
        expect(await sGLMR.balanceOf(mcv2.address)).to.be.equal("1000000000000000000");
        expect(await sGLMR.balanceOf(player1.address)).to.be.equal("0");
        expect(await sGLMR.balanceOf(player2.address)).to.be.equal("0");

        console.log(await mcv2.userInfo(0,player1.address));
        console.log(await mcv2.userInfo(0,player2.address));
      });

      it("Can emit correct event", async function() {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        await expect(glmrDepositor.connect(player1).depositAndStake(player1.address, overrides))
          .to.emit(glmrDepositor, "Deposited")
          .withArgs(player1.address, ethers.utils.parseEther("1.0"), true);
      });
    })
  })

  describe("Delegate", function() {
    let player1DepositValue = ethers.utils.parseEther("10.0");
    let player2DepositValue = ethers.utils.parseEther("20.0");
    let delegatedValue1 = ethers.utils.parseEther("11.0")
    let delegatedValue2 = ethers.utils.parseEther("19.0")
    let totalDepositedExpected;
    let totalDelegatedExpected;

    context("No operator role", function() {
      it("Cannot delegate if not operator", async function () {
        await expect(glmrDepositor.connect(player1).delegate(candidate1.address, delegatedValue1)).to.be.revertedWith(
          "GLMRDepositor.onlyOperator: permission denied"
        );
      });
    })

    context("Has operator role", function() {
      beforeEach(async () => {
        await glmrDepositor.connect(owner).grantRole(await glmrDepositor.OPERATOR_ROLE(), player1.address);
      });

      it("Cannot delegate to zero address", async function() {
        await expect(glmrDepositor.connect(player1).delegate(ZERO_ADDRESS, delegatedValue1)).to.be.revertedWith(
          "GLMRDepositor.delegate: candidate cannot be zero address"
        );
      });

      it("Cannot delegate zero amount", async function() {
        await expect(glmrDepositor.connect(player1).delegate(candidate1.address, 0)).to.be.revertedWith(
          "GLMRDepositor.delegate: amount cannot be zero"
        );
      });

      it("Cannot delegate when nobody deposited", async function() {
        await expect(glmrDepositor.connect(player1).delegate(candidate1.address, delegatedValue1)).to.be.revertedWith(
          "GLMRDepositor.delegate: not enough GLMR"
        );
      });
    })

    context("With deposits", function() {
      beforeEach(async () => {
        await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);

        overrides = { 
          value: player1DepositValue
        };
        await glmrDepositor.connect(player1).deposit(player1.address, overrides);

        overrides = { 
          value: player2DepositValue
        };
        await glmrDepositor.connect(player2).deposit(player2.address, overrides);
      });

      it("Can successfully delegate with deposits", async function() {
        await glmrDepositor.connect(owner).delegate(candidate1.address, delegatedValue1);
        await glmrDepositor.connect(owner).delegate(candidate2.address, delegatedValue2);

        totalDepositedExpected = player1DepositValue.add(player2DepositValue);
        totalDelegatedExpected = delegatedValue1.add(delegatedValue2);
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegatedValue1);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegatedValue2);
        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(totalDepositedExpected.sub(totalDelegatedExpected));
      });

      it("Can emit correct event", async function() {
        await expect(glmrDepositor.delegate(candidate1.address, delegatedValue1))
          .to.emit(glmrDepositor, 'Delegated')
          .withArgs(candidate1.address, delegatedValue1);
      });
    })
  })

  describe("advanceEpoch", function() {
    let player1DepositValue = ethers.utils.parseEther("10.0");
    let player2DepositValue = ethers.utils.parseEther("20.0");
    let delegatedValue1 = ethers.utils.parseEther("11.0")
    let delegatedValue2 = ethers.utils.parseEther("19.0")
    let totalDepositedExpected;
    let totalDelegatedExpected;

    beforeEach(async () => {
      await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
      expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);

      overrides = { 
        value: player1DepositValue
      };
      await glmrDepositor.connect(player1).deposit(player1.address, overrides);

      overrides = { 
        value: player2DepositValue
      };
      await glmrDepositor.connect(player2).deposit(player2.address, overrides);

      await glmrDepositor.connect(owner).delegate(candidate1.address, delegatedValue1);
      await glmrDepositor.connect(owner).delegate(candidate2.address, delegatedValue2);

      totalDepositedExpected = player1DepositValue.add(player2DepositValue);
      totalDelegatedExpected = delegatedValue1.add(delegatedValue2);
      expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
      expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected);
      expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(totalDepositedExpected.sub(totalDelegatedExpected));
    });

    context("No operator role", function() {
      it("Cannot advanceEpoch if not operator", async function () {
        await expect(glmrDepositor.connect(player1).advanceEpoch([], [])).to.be.revertedWith(
          "GLMRDepositor.onlyOperator: permission denied"
        );
      })
    })

    context("Has operator role", function() {
      beforeEach(async () => {
        await glmrDepositor.connect(owner).grantRole(await glmrDepositor.OPERATOR_ROLE(), player1.address);
      });

      it("Cannot advanceEpoch if candidates and amounts mismatch", async function () {
        await expect(glmrDepositor.connect(player1).advanceEpoch([candidate1.address], [])).to.be.revertedWith(
          "GLMRDepositor.advanceEpoch: candidates and amounts length mismatch"
        );
      })

      it("Cannot advanceEpoch if block hasn't passed through the next epoch", async function () {
        await expect(glmrDepositor.connect(player1).advanceEpoch([], [])).to.be.revertedWith(
          "GLMRDepositor.advanceEpoch: too soon"
        );
      })

      context("Block pass through the next epoch", function() {
        beforeEach(async () => {
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        })

        afterEach(async () => {
          await hre.network.provider.send("hardhat_reset");
        })

        it("Cannot advanceEpoch and schedule withdraw for zero address candidate", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          await expect(glmrDepositor.connect(player1).advanceEpoch([ZERO_ADDRESS], [0])).to.be.revertedWith(
            "GLMRDepositor.advanceEpoch: candidate cannot be zero address"
          );
        })
  
        it("Cannot advanceEpoch and schedule withdraw for zero amount", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          await expect(glmrDepositor.connect(player1).advanceEpoch([candidate1.address], [0])).to.be.revertedWith(
            "GLMRDepositor.advanceEpoch: amount cannot be zero"
          );
        })
  
        it("Cannot advanceEpoch and schedule withdraw less than total pending", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);
  
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          expect(pending).to.be.equal(player1DepositValue);
  
          await expect(glmrDepositor.connect(player1).advanceEpoch([candidate2.address], [pending.sub(1)])).to.be.revertedWith(
            "GLMRDepositor.advanceEpoch: remaining pending withdraw should be zero"
          );
        })
  
        it("Can advanceEpoch and schedule withdraw more than total pending but the excess amount won't be scheduled", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);
  
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          expect(pending).to.be.equal(player1DepositValue);
  
          await glmrDepositor.connect(player1).advanceEpoch([candidate2.address], [pending.add(1)]);
  
          expect(await glmrDepositor.totalScheduled()).to.be.equal(pending);
        })
  
        it("Can advanceEpoch if no candidate's delegation request needs to be executed and no withdraw to be scheduled", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          let epochBefore = await glmrDepositor.epoch();
          await glmrDepositor.connect(owner).advanceEpoch([], []);
          let epochAfter = await glmrDepositor.epoch();
  
          expect(epochAfter.number.sub(epochBefore.number)).to.be.equal(1);
          expect(epochAfter.end.sub(epochBefore.end)).to.be.above(EPOCH_DURATION*ROUND_DURATION);
          expect(epochAfter.userPending).to.be.equal(0);
          expect(epochAfter.adminPending).to.be.equal(0);
          expect(await glmrDepositor.totalScheduled()).to.be.equal(0);
        })
  
        it("Can advanceEpoch and schedule withdraw successfully", async function () {
          let pendingCandidatesWithDelegationRequest = await glmrDelegator.getPendingCandidatesLength();
          expect(pendingCandidatesWithDelegationRequest).to.be.equal(0);
  
          await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);
  
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          expect(pending).to.be.equal(player1DepositValue);
  
          let epochBefore = await glmrDepositor.epoch();
          await glmrDepositor.connect(owner).advanceEpoch([candidate1.address, candidate2.address], [pending.div(2), pending.div(2)]);
          let epochAfter = await glmrDepositor.epoch();
  
          expect(epochAfter.number.sub(epochBefore.number)).to.be.equal(1);
          expect(epochAfter.end.sub(epochBefore.end)).to.be.above(EPOCH_DURATION*ROUND_DURATION);
          expect(epochAfter.userPending).to.be.equal(0);
          expect(epochAfter.adminPending).to.be.equal(0);
          expect(await glmrDepositor.totalScheduled()).to.be.equal(pending);
        })
      })
    });
  })

  describe("Schedule Withdraw", function() {
    let player1DepositValue
    let player2DepositValue
    let totalDepositedExpected;

    beforeEach(async () => {
      await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
      expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);


      player1DepositValue = ethers.utils.parseEther("10.0");
      overrides = { 
        value: player1DepositValue
      };
      await glmrDepositor.connect(player1).deposit(player1.address, overrides);

      player2DepositValue = ethers.utils.parseEther("20.0");
      overrides = { 
        value: player2DepositValue
      };
      await glmrDepositor.connect(player2).deposit(player2.address, overrides);

      totalDepositedExpected = player1DepositValue.add(player2DepositValue);
    });

    it("Cannot schedule withdraw 0 amount", async function () {
      await expect(glmrDepositor.connect(player1).scheduleWithdraw(0)).to.be.revertedWith(
        "GLMRDepositor.scheduleWithdraw: cannot schedule withdraw 0 GLMR"
      );
    });

    it("Cannot schedule withdraw more amount than the mGLMR you have", async function () {
      await expect(glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue.mul(2))).to.be.revertedWith(
        "GLMRDepositor.scheduleWithdraw: not enough mGLMR"
      );
    });

    it("Can schedule withdraw successfully", async function() {
      let userPendingWithdrawLength = await glmrDepositor.getUserPendingWithdrawsLength(player1.address);
      expect(userPendingWithdrawLength).to.be.equal(0);

      expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
      expect(await mGLMR.balanceOf(player1.address)).to.be.equal(player1DepositValue);

      await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);

      expect(await mGLMR.balanceOf(player1.address)).to.be.equal(0);

      userPendingWithdrawLength = await glmrDepositor.getUserPendingWithdrawsLength(player1.address);
      expect(userPendingWithdrawLength).to.be.equal(1);

      let userPendingWithdraws = await glmrDepositor.getUserPendingWithdraws(player1.address);
      expect(userPendingWithdraws[0].amount).to.be.equal(player1DepositValue);
      let currentEpoch = await glmrDepositor.currentEpoch();
      let EXIT_EPOCH_DURATION = await glmrDepositor.EXIT_EPOCH_DURATION();
      expect(userPendingWithdraws[0].unlockEpoch.sub(currentEpoch)).to.be.equal(EXIT_EPOCH_DURATION);

      let epoch = await glmrDepositor.epoch();
      expect(epoch.userPending).to.be.equal(player1DepositValue);
      expect(epoch.adminPending).to.be.equal(0);
      expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
    });

    it("Can emit correct event", async function() {
      let epoch = await glmrDepositor.epoch();

      await expect(glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue))
        .to.emit(glmrDepositor, 'WithdrawScheduled')
        .withArgs(player1.address, player1DepositValue, epoch.number);
    });
  })

  describe("Withdarw", function() {
    afterEach(async () => {
      await hre.network.provider.send("hardhat_reset");
    })

    it("Cannot withdraw when not scheduled", async function () {
      await expect(glmrDepositor.connect(player1).withdraw(0, player1.address)).to.be.revertedWith(
        "GLMRDepositor.withdraw: Pending GLMRs does not exist"
      );
    });

    context("When scheduled", function() {
      let player1DepositValue
      let player2DepositValue
      let delegatedValue1
      let delegatedValue2
      let scheduledValue

      beforeEach(async () => {
        await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);

        player1DepositValue = ethers.utils.parseEther("10.0");
        overrides = { 
          value: player1DepositValue
        };
        await glmrDepositor.connect(player1).deposit(player1.address, overrides);

        player2DepositValue = ethers.utils.parseEther("20.0");
        overrides = { 
          value: player2DepositValue
        };
        await glmrDepositor.connect(player2).deposit(player2.address, overrides);

        delegatedValue1 = ethers.utils.parseEther("11.0")
        delegatedValue2 = ethers.utils.parseEther("19.0")
        
        await glmrDepositor.connect(owner).delegate(candidate1.address, delegatedValue1);
        await glmrDepositor.connect(owner).delegate(candidate2.address, delegatedValue2);
  
        scheduledValue = player1DepositValue
        await glmrDepositor.connect(player1).scheduleWithdraw(scheduledValue);
      });

      it("Cannot withdraw when no epoch is advanced", async function () {
        await expect(glmrDepositor.connect(player1).withdraw(0, player1.address)).to.be.revertedWith(
          "GLMRDepositor.withdraw: Too soon"
        );
      });

      it("Cannot withdraw when only advance pass 1 epoch", async function () {
        let epoch = await glmrDepositor.epoch();
        let pending = epoch.userPending.add(epoch.adminPending);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);

        await expect(glmrDepositor.connect(player1).withdraw(0, player1.address)).to.be.revertedWith(
          "GLMRDepositor.withdraw: Too soon"
        );
      });

      it("Cannot withdraw more than you scheduled", async function() {
        let epoch = await glmrDepositor.epoch();
        let pending = epoch.userPending.add(epoch.adminPending);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([], []);

        await expect(glmrDepositor.connect(player1).withdraw(1, player1.address)).to.be.revertedWith(
          "GLMRDepositor.withdraw: Pending GLMRs does not exist"
        );
      });

      it("Can successfully withdraw when two epoch has passed and the correct candidate's delegation request is executed", async function() {
        let epoch = await glmrDepositor.epoch();
        let pending = epoch.userPending.add(epoch.adminPending);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([], []);

        let balancesBefore = await ethers.provider.getBalance(player2.address);
        let totalScheduledBefore = await glmrDepositor.totalScheduled();
        let totalDepositedBefore = await glmrDepositor.totalDeposited();
        await glmrDepositor.connect(player1).withdraw(0, player2.address);
        let balancesAfter = await ethers.provider.getBalance(player2.address);
        let totalScheduledAfter = await glmrDepositor.totalScheduled();
        let totalDepositedAfter = await glmrDepositor.totalDeposited();

        expect(balancesAfter.sub(balancesBefore)).to.be.equal(scheduledValue);
        expect(totalScheduledBefore.sub(totalScheduledAfter)).to.be.equal(scheduledValue);
        expect(totalDepositedBefore.sub(totalDepositedAfter)).to.be.equal(scheduledValue);
      });

      it("Can emit correct event", async function() {
        let epoch = await glmrDepositor.epoch();
        let pending = epoch.userPending.add(epoch.adminPending);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
        await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
        await glmrDepositor.connect(owner).advanceEpoch([], []);

        await expect(glmrDepositor.connect(player1).withdraw(0, player2.address))
          .to.emit(glmrDepositor, 'Withdrawn')
          .withArgs(0, player2.address, player1.address, scheduledValue);
      });
    })
  })

  describe("Admin Schedule Withdraw", function() {
    let player1DepositValue
    let player2DepositValue
    let totalDepositedExpected;

    beforeEach(async () => {
      await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
      expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);


      player1DepositValue = ethers.utils.parseEther("10.0");
      overrides = { 
        value: player1DepositValue
      };
      await glmrDepositor.connect(player1).deposit(player1.address, overrides);

      player2DepositValue = ethers.utils.parseEther("20.0");
      overrides = { 
        value: player2DepositValue
      };
      await glmrDepositor.connect(player2).deposit(player2.address, overrides);

      totalDepositedExpected = player1DepositValue.add(player2DepositValue);
    });

    context("No admin role", function() {
      it("Cannot call adminScheduleWithdraw if not admin", async function () {
        await expect(glmrDepositor.connect(player1).adminScheduleWithdraw(0)).to.be.revertedWith(
          "GLMRDepositor.onlyAdmin: permission denied"
        );
      })
    })

    context("Has admiin role", function() {
      beforeEach(async () => {
        await glmrDepositor.connect(owner).grantRole(await glmrDepositor.ADMIN_ROLE(), player1.address);
      });

      it("Cannot schedule withdraw 0 amount", async function () {
        await expect(glmrDepositor.connect(player1).adminScheduleWithdraw(0)).to.be.revertedWith(
          "GLMRDepositor.adminScheduleWithdraw: cannot schedule withdraw 0 GLMR"
        );
      });

      it("Cannot schedule withdraw more amount than the totalDeposited amount", async function () {
        await expect(glmrDepositor.connect(player1).adminScheduleWithdraw(totalDepositedExpected.add(1))).to.be.revertedWith(
          "GLMRDepositor.adminScheduleWithdraw: not enough GLMR"
        );
      });

      it("Cannot schedule withdraw more amount than the totalAvailable amount", async function () {
        await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);
        let availableAmount = totalDepositedExpected.sub(player1DepositValue);
        await expect(glmrDepositor.connect(player1).adminScheduleWithdraw(availableAmount.add(1))).to.be.revertedWith(
          "GLMRDepositor.adminScheduleWithdraw: not enough GLMR"
        );
      });

      it("Can schedule admin withdraw successfully", async function() {
        let adminPendingWithdrawLength = await glmrDepositor.getAdminPendingWithdrawsLength(player1.address);
        expect(adminPendingWithdrawLength).to.be.equal(0);
  
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
        expect(await mGLMR.balanceOf(player1.address)).to.be.equal(player1DepositValue);
  
        let adminScheduledAmount = totalDepositedExpected.div(2);
        await glmrDepositor.connect(player1).adminScheduleWithdraw(adminScheduledAmount);
  
        expect(await mGLMR.balanceOf(player1.address)).to.be.equal(player1DepositValue);
  
        adminPendingWithdrawLength = await glmrDepositor.getAdminPendingWithdrawsLength(player1.address);
        expect(adminPendingWithdrawLength).to.be.equal(1);
  
        let adminPendingWithdraws = await glmrDepositor.getAdminPendingWithdraws(player1.address);
        expect(adminPendingWithdraws[0].amount).to.be.equal(adminScheduledAmount);
        let currentEpoch = await glmrDepositor.currentEpoch();
        let EXIT_EPOCH_DURATION = await glmrDepositor.EXIT_EPOCH_DURATION();
        expect(adminPendingWithdraws[0].unlockEpoch.sub(currentEpoch)).to.be.equal(EXIT_EPOCH_DURATION);
  
        let epoch = await glmrDepositor.epoch();
        expect(epoch.userPending).to.be.equal(0);
        expect(epoch.adminPending).to.be.equal(adminScheduledAmount);
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
      });

      it("Can emit correct event", async function() {
        let epoch = await glmrDepositor.epoch();
        let adminScheduledAmount = totalDepositedExpected.div(2);  
  
        await expect(glmrDepositor.connect(player1).adminScheduleWithdraw(adminScheduledAmount))
          .to.emit(glmrDepositor, 'AdminWithdrawScheduled')
          .withArgs(player1.address, adminScheduledAmount, epoch.number);
      });
    })
  })

  describe("Admin Redelegate", function() {
    context("No admin role", function() {
      it("Cannot redelegate if not admin", async function () {
        await expect(glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address)).to.be.revertedWith(
          "GLMRDepositor.onlyAdmin: permission denied"
        );
      })
    })

    context("Has amdin role", function() {
      beforeEach(async () => {
        await glmrDepositor.connect(owner).grantRole(await glmrDepositor.ADMIN_ROLE(), player1.address);
      });

      it("Cannot redelegate when not scheduled", async function () {
        await expect(glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address)).to.be.revertedWith(
          "GLMRDepositor.adminRedelegate: Pending GLMRs does not exist"
        );
      });

      context("When scheduled", function() {
        let player1DepositValue
        let player2DepositValue
        let delegatedValue1
        let delegatedValue2
        let scheduledValue
  
        beforeEach(async () => {
          await mGLMR.connect(owner).grantRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address);
          expect(await mGLMR.hasRole(await mGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);
  
          player1DepositValue = ethers.utils.parseEther("10.0");
          overrides = { 
            value: player1DepositValue
          };
          await glmrDepositor.connect(player1).deposit(player1.address, overrides);
  
          player2DepositValue = ethers.utils.parseEther("20.0");
          overrides = { 
            value: player2DepositValue
          };
          await glmrDepositor.connect(player2).deposit(player2.address, overrides);
  
          delegatedValue1 = ethers.utils.parseEther("11.0")
          delegatedValue2 = ethers.utils.parseEther("19.0")
          
          await glmrDepositor.connect(owner).delegate(candidate1.address, delegatedValue1);
          await glmrDepositor.connect(owner).delegate(candidate2.address, delegatedValue2);
    
          scheduledValue = delegatedValue2.div(2);
          await glmrDepositor.connect(player1).adminScheduleWithdraw(scheduledValue);
        });
  
        it("Cannot redelegate when no epoch is advanced", async function () {
          await expect(glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address)).to.be.revertedWith(
            "GLMRDepositor.adminRedelegate: Too soon"
          );
        });
  
        it("Cannot redelegate when only advance pass 1 epoch", async function () {
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
  
          await expect(glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address)).to.be.revertedWith(
            "GLMRDepositor.adminRedelegate: Too soon"
          );
        });
  
        it("Cannot redelegate more than you scheduled", async function() {
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([], []);
  
          await expect(glmrDepositor.connect(player1).adminRedelegate(1, candidate3.address)).to.be.revertedWith(
            "GLMRDepositor.adminRedelegate: Pending GLMRs does not exist"
          );
        });
  
        it("Can successfully redelegate when two epoch has passed and the correct candidate's delegation request is executed", async function() {
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([], []);
  
          let totalScheduledBefore = await glmrDepositor.totalScheduled();
          let totalDepositedBefore = await glmrDepositor.totalDeposited();
          await glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address);
          let totalScheduledAfter = await glmrDepositor.totalScheduled();
          let totalDepositedAfter = await glmrDepositor.totalDeposited();
  
          expect(totalScheduledBefore.sub(totalScheduledAfter)).to.be.equal(scheduledValue);
          expect(totalDepositedBefore.sub(totalDepositedAfter)).to.be.equal(0);
        });

        it("Can emit correct event", async function() {  
          let epoch = await glmrDepositor.epoch();
          let pending = epoch.userPending.add(epoch.adminPending);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([candidate2.address], [pending]);
          await hre.network.provider.send("hardhat_mine", [BLOCKS_PER_EPOCH_HEX]);
          await glmrDepositor.connect(owner).advanceEpoch([], []);
    
          await expect(glmrDepositor.connect(player1).adminRedelegate(0, candidate3.address))
            .to.emit(glmrDepositor, 'AdminRedelegated')
            .withArgs(0, candidate3.address, player1.address, scheduledValue);
        });
      })
    })
  })
});