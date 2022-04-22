const { expect } = require("chai");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("GLMRDepositor", function () {
  let owner;
  let candidate1;
  let candidate2;
  let candidate3;
  let player1;
  let player2;
  let newGLMRDelegator;
  let newSGLMRStaking;

  let MockParachainStakingFactory;
  let MockGLMRDelegatorFactory;
  let GLMRDepositorFactory;
  let MockSGLMRStakingFactory;
  let SGLMRFactory;

  let parachainStaking;
  let glmrDepositor;
  let glmrDelegator;
  let sGLMRStaking;
  let sGLMR;
  let EXIT_DURATION = 600;
  let MIN_DELEGATION = "5000000000000000000";
  let NEW_EXIT_DURATION = 1200;

  before(async () => {
    MockParachainStakingFactory = await ethers.getContractFactory("MockParachainStaking");
    MockGLMRDelegatorFactory = await ethers.getContractFactory("MockGLMRDelegator");
    GLMRDepositorFactory = await ethers.getContractFactory("GLMRDepositor");
    MockSGLMRStakingFactory = await ethers.getContractFactory("MockSGLMRStaking");
    SGLMRFactory = await ethers.getContractFactory("SGLMR");
  });

  beforeEach(async () => {
    [owner, candidate1, candidate2, candidate3, player1, player2, newGLMRDelegator, newSGLMRStaking] = await ethers.getSigners();

    parachainStaking = await MockParachainStakingFactory.connect(owner).deploy();
    sGLMR = await SGLMRFactory.connect(owner).deploy();
    sGLMRStaking = await MockSGLMRStakingFactory.connect(owner).deploy(sGLMR.address);
    glmrDelegator = await MockGLMRDelegatorFactory.connect(owner).deploy(parachainStaking.address);
    glmrDepositor = await GLMRDepositorFactory.connect(owner).deploy(glmrDelegator.address, sGLMR.address, sGLMRStaking.address, EXIT_DURATION);
    await parachainStaking.connect(owner).setGLMRDelegator(glmrDelegator.address);
    await glmrDelegator.connect(owner).grantRole(await glmrDelegator.DEPOSITOR_ROLE(), glmrDepositor.address);

    expect(await glmrDepositor.hasRole(await glmrDepositor.ADMIN_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrDepositor.sGLMR()).to.be.equal(sGLMR.address);
    expect(await glmrDepositor.sGLMRStaking()).to.be.equal(sGLMRStaking.address);
  });


  describe("Constructor", function() {
    it("Cannot deploy with zero glmrDelegator address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(ZERO_ADDRESS, sGLMR.address, sGLMRStaking.address, EXIT_DURATION)).to.be.revertedWith(
        "GLMRDepositor.constructor: glmrDelegator cannot be zero address"
        );
    });

    it("Cannot deploy with zero sGLMR address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, ZERO_ADDRESS, sGLMRStaking.address, EXIT_DURATION)).to.be.revertedWith(
        "GLMRDepositor.constructor: sGLMR cannot be zero address"
        );
    });

    it("Cannot deploy with zero sGLMRStaking address", async function () {
      await expect(GLMRDepositorFactory.connect(owner).deploy(parachainStaking.address, sGLMR.address, ZERO_ADDRESS, EXIT_DURATION)).to.be.revertedWith(
        "GLMRDepositor.constructor: sGLMRStaking cannot be zero address"
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
        "GLMRDepositor.constructor: glmrDelegator cannot be zero address"
      );
    })

    it("Can successfully update GLMRDelegator", async function () {
      expect(await glmrDepositor.glmrDelegator()).to.be.equal(glmrDelegator.address);
      await glmrDepositor.connect(owner).updateGLMRDelegator(newGLMRDelegator.address);
      expect(await glmrDepositor.glmrDelegator()).to.be.equal(newGLMRDelegator.address);
    })
  })

  describe("updateSGLMRStaking", function() {
    it("Cannot updateSGLMRStaking if not admin", async function () {
      await expect(glmrDepositor.connect(player1).updateSGLMRStaking(newSGLMRStaking.address)).to.be.revertedWith(
        "GLMRDepositor.onlyAdmin: permission denied"
      );
    })

    it("Cannot updateSGLMRStaking to zero address", async function () {
      await expect(glmrDepositor.connect(owner).updateSGLMRStaking(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRDepositor.constructor: sGLMRStaking cannot be zero address"
      );
    })

    it("Can successfully update sGLMRStaking", async function () {
      expect(await glmrDepositor.sGLMRStaking()).to.be.equal(sGLMRStaking.address);
      await glmrDepositor.connect(owner).updateSGLMRStaking(newSGLMRStaking.address);
      expect(await glmrDepositor.sGLMRStaking()).to.be.equal(newSGLMRStaking.address);
    })
  })

  describe("updateExitDuration", function() {
    it("Cannot updateExitDuration if not admin", async function () {
      await expect(glmrDepositor.connect(player1).updateExitDuration(NEW_EXIT_DURATION)).to.be.revertedWith(
        "GLMRDepositor.onlyAdmin: permission denied"
      );
    })

    it("Can successfully update exit duration", async function () {
      expect(await glmrDepositor.exitDuration()).to.be.equal(EXIT_DURATION);
      await glmrDepositor.connect(owner).updateExitDuration(NEW_EXIT_DURATION);
      expect(await glmrDepositor.exitDuration()).to.be.equal(NEW_EXIT_DURATION);
    })
  })

  describe("Deposit", function() {
    context("No minter role", function() {
      it("Cannot deposit if GLMRDepositor doesn't have minter role of sGLMR", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).deposit(player1.address, overrides)).to.be.revertedWith(
          "SGLMR: only minter"
        );
      })
    })
  
    context("Has minter role", function() {
      beforeEach(async () => {
        await sGLMR.connect(owner).grantRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await sGLMR.hasRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);
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
        expect(await sGLMR.balanceOf(player1.address)).to.be.equal("1000000000000000000");
      });

      it("Can successfully deposit for others", async function () {
        overrides = { 
          value: ethers.utils.parseEther("1.0")
        };

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(0);

        await glmrDepositor.connect(player1).deposit(player2.address, overrides);

        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal("1000000000000000000");
        expect(await glmrDepositor.totalDeposited()).to.be.equal("1000000000000000000");
        expect(await sGLMR.balanceOf(player2.address)).to.be.equal("1000000000000000000");
      });
    })
  })

  describe("Deposit And Stake", function() {
    context("No minter role", function() {
      it("Cannot deposit and stake if GLMRDepositor doesn't have minter role of sGLMR", async function () {
        overrides = { 
          value: ethers.utils.parseEther("0.5")
        };
        await expect(glmrDepositor.connect(player1).depositAndStake(player1.address, overrides)).to.be.revertedWith(
          "SGLMR: only minter"
        );
      })
    })
  
    context("Has minter role", function() {
      beforeEach(async () => {
        await sGLMR.connect(owner).grantRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await sGLMR.hasRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);
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
        expect(await sGLMR.balanceOf(player1.address)).to.be.equal("0");
        expect(await sGLMR.balanceOf(sGLMRStaking.address)).to.be.equal("1000000000000000000");
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
        expect(await sGLMR.balanceOf(player2.address)).to.be.equal("0");
        expect(await sGLMR.balanceOf(sGLMRStaking.address)).to.be.equal("1000000000000000000");
      });
    })
  })

  describe("Schedule Withdraw", function() {
    let player1DepositValue
    let player2DepositValue

    beforeEach(async () => {
      await sGLMR.connect(owner).grantRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address);
      expect(await sGLMR.hasRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);

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
    });

    it("Cannot schedule withdraw 0 amount", async function () {
      await expect(glmrDepositor.connect(player1).scheduleWithdraw(0)).to.be.revertedWith(
        "GLMRDepositor.scheduleWithdraw: cannot schedule withdraw 0 GLMR"
      );
    });

    it("Cannot schedule withdraw more amount than the sGLMR you have", async function () {
      await expect(glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue.mul(2))).to.be.revertedWith(
        "GLMRDepositor.scheduleWithdraw: not enough sGLMR"
      );
    });

    context("When not delegated", function() {
      it("Can not schedule withdraw when no GLMR is delegated", async function() {
        await expect(glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue)).to.be.revertedWith(
          "GLMRDelegator.runScheduleWithdraw: not enough GLMR delegated for withdraw"
        );
      });
    });

    context("When delegated", function() {
      let delegatedValue1 = ethers.utils.parseEther("11.0")
      let delegatedValue2 = ethers.utils.parseEther("19.0")
      let totalDepositedExpected;
      let totalDelegatedExpected;
      
      beforeEach(async () => {
        await glmrDepositor.connect(owner).delegate(candidate1.address, delegatedValue1);
        await glmrDepositor.connect(owner).delegate(candidate2.address, delegatedValue2);

        totalDepositedExpected = player1DepositValue.add(player2DepositValue);
        totalDelegatedExpected = delegatedValue1.add(delegatedValue2);
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected);
        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(totalDepositedExpected.sub(totalDelegatedExpected));
      });

      it("Can schedule withdraw successfully from the delegator with highest delegations (from single delegator)", async function() {
        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(totalDepositedExpected.sub(totalDelegatedExpected));
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegatedValue1);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegatedValue2);

        await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);

        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(player1DepositValue);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegatedValue1);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegatedValue2.sub(player1DepositValue));

        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected.sub(player1DepositValue));
        expect(await glmrDepositor.totalScheduled()).to.be.equal(player1DepositValue);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected.sub(player1DepositValue));
        expect(await glmrDelegator.totalPending()).to.be.equal(player1DepositValue);
        expect(await sGLMR.balanceOf(player1.address)).to.be.equal(0);
        
        let userPendingWithdraw = await glmrDepositor.userPendingWithdraws(player1.address, 0);
        expect(userPendingWithdraw.amount).to.be.equal(player1DepositValue);
        expect(userPendingWithdraw.end.sub(userPendingWithdraw.start)).to.be.equal(EXIT_DURATION);
      })

      it("Can schedule withdraw successfully from the delegator with highest delegations (from two delegators)", async function() {
        expect(await ethers.provider.getBalance(glmrDepositor.address)).to.be.equal(totalDepositedExpected.sub(totalDelegatedExpected));
        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegatedValue1);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegatedValue2);

        await glmrDepositor.connect(player2).scheduleWithdraw(player2DepositValue);

        let totalAmountScheduledToWithdrawFromCandidate1 = player2DepositValue.sub(totalDepositedExpected.sub(totalDelegatedExpected)).sub(delegatedValue2.sub(MIN_DELEGATION))
        let totalAmountScheduledToWithdrawFromCandidate2 = delegatedValue2.sub(MIN_DELEGATION)
        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(totalAmountScheduledToWithdrawFromCandidate1.add(totalAmountScheduledToWithdrawFromCandidate2));
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegatedValue1.sub(totalAmountScheduledToWithdrawFromCandidate1));
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegatedValue2.sub(totalAmountScheduledToWithdrawFromCandidate2));

        expect(await glmrDepositor.totalDeposited()).to.be.equal(totalDepositedExpected.sub(player2DepositValue));
        expect(await glmrDepositor.totalScheduled()).to.be.equal(player2DepositValue);

        expect(await glmrDelegator.totalDelegated()).to.be.equal(totalDelegatedExpected.sub(player2DepositValue));
        expect(await glmrDelegator.totalPending()).to.be.equal(player2DepositValue);
        expect(await sGLMR.balanceOf(player2.address)).to.be.equal(0);
        
        let userPendingWithdraw = await glmrDepositor.userPendingWithdraws(player2.address, 0);
        expect(userPendingWithdraw.amount).to.be.equal(player2DepositValue);
        expect(userPendingWithdraw.end.sub(userPendingWithdraw.start)).to.be.equal(EXIT_DURATION);
      })
    });
    
  })

  describe("Withdarw", function() {
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

      beforeEach(async () => {
        await sGLMR.connect(owner).grantRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address);
        expect(await sGLMR.hasRole(await sGLMR.MINTER_ROLE(), glmrDepositor.address)).to.be.equal(true);

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
  
        await glmrDepositor.connect(player1).scheduleWithdraw(player1DepositValue);
      });

      it("Cannot withdraw within exit duration", async function () {
        await expect(glmrDepositor.connect(player1).withdraw(0, player1.address)).to.be.revertedWith(
          "GLMRDepositor.withdraw: Too soon"
        );
      });

      it("Can not successfully withdraw when the withdraw delegation request is not executed", async function() {
        await network.provider.send("evm_increaseTime", [600]);
        await network.provider.send("evm_mine", []);

        await expect(glmrDepositor.connect(player1).withdraw(0, player1.address)).to.be.revertedWith(
          "GLMRDelegator.runWithdraw: no enough GLMRs"
        );
      });
    })
    
  })
});