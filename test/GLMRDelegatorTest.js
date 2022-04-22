const { expect } = require("chai");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("GLMRDelegator", function () {
  let owner;
  let player1;

  let MockParachainStakingFactory;
  let MockGLMRDelegatorFactory;

  let parachainStaking;
  let glmrDelegator;

  before(async () => {
    MockParachainStakingFactory = await ethers.getContractFactory("MockParachainStaking");
    MockGLMRDelegatorFactory = await ethers.getContractFactory("MockGLMRDelegator");
  });

  beforeEach(async () => {
    [owner, candidate1, candidate2, candidate3, player1, player2] = await ethers.getSigners();

    parachainStaking = await MockParachainStakingFactory.connect(owner).deploy();
    glmrDelegator = await MockGLMRDelegatorFactory.connect(owner).deploy(parachainStaking.address);
    await parachainStaking.connect(owner).setGLMRDelegator(glmrDelegator.address);

    expect(await glmrDelegator.hasRole(await glmrDelegator.ASSETS_MANAGER_ROLE(), owner.address)).to.be.equal(true);
    expect(await glmrDelegator.stakingDelegations()).to.be.equal(parachainStaking.address);
  });

  describe("Constructor", function() {
    it("Cannot deploy with zero stakingDelegations address", async function () {
      await expect(MockGLMRDelegatorFactory.connect(owner).deploy(ZERO_ADDRESS)).to.be.revertedWith(
        "GLMRDelegator.constructor: stakingDelegations cannot be zero address"
        );
    });
  })

  describe("Candidate Delegations", function() {
    context("addCandidate", function() {
      it("cannot add candiate that already in the list", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
       
        await expect(glmrDelegator.addCandidate(candidate1.address, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator._addCandidate: candidate already in the list"
          );
      })

      it("can add candiate to the expected position", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(2);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate2.address);
        expect(topList[1]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("3000000000000000000");
      })

      it("can emit correct event", async function() {
        await expect(await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000"))
          .to.emit(glmrDelegator, 'CandidateAdded')
          .withArgs(candidate1.address, "1000000000000000000");
      })
    })

    context("removeCandidate", function() {
      it("cannot remove candiate that are not in the list", async function() {       
        await expect(glmrDelegator.removeCandidate(candidate1.address)).to.be.revertedWith(
          "GLMRDelegator._removeCandidate: candidate not in the list"
          );
      })

      it("can successfully remove candiate", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");

        await glmrDelegator.removeCandidate(candidate2.address);

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(1);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(0);
      })

      it("can emit correct event", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");


        await expect(await glmrDelegator.removeCandidate(candidate2.address))
          .to.emit(glmrDelegator, 'CandidateRemoved')
          .withArgs(candidate2.address);
      })
    })

    context("increaseDelegation", function() {
      it("cannot increase delegation for candidates that are not in the list", async function() {       
        await expect(glmrDelegator.increaseDelegation(candidate1.address, "1000000000000000000")).to.be.revertedWith(
          "GLMRDelegator._increaseDelegation: candidate not in the list"
          );
      })

      it("can successfully increase candiate delegations", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(2);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate2.address);
        expect(topList[1]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("3000000000000000000");

        await glmrDelegator.increaseDelegation(candidate1.address, "3000000000000000000");

        listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(2);
        topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate1.address);
        expect(topList[1]).to.be.equal(candidate2.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("4000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("3000000000000000000");
      })

      it("can emit correct event", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");


        await expect(await glmrDelegator.increaseDelegation(candidate1.address, "3000000000000000000"))
          .to.emit(glmrDelegator, 'DelegationIncreased')
          .withArgs(candidate1.address, "3000000000000000000");
      })
    })

    context("reduceDelegation", function() {
      it("cannot reduce delegation for candidates that are not in the list", async function() {       
        await expect(glmrDelegator.reduceDelegation(candidate1.address, "1000000000000000000")).to.be.revertedWith(
          "GLMRDelegator._reduceDelegation: candidate not in the list"
          );
      })

      it("can successfully reduce candiate delegations", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(2);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate2.address);
        expect(topList[1]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("3000000000000000000");

        await glmrDelegator.reduceDelegation(candidate2.address, "2500000000000000000");

        listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(2);
        topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate1.address);
        expect(topList[1]).to.be.equal(candidate2.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("500000000000000000");
      })

      it("can emit correct event", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "3000000000000000000");


        await expect(await glmrDelegator.reduceDelegation(candidate2.address, "2500000000000000000"))
          .to.emit(glmrDelegator, 'DelegationReduced')
          .withArgs(candidate2.address, "2500000000000000000");
      })
    })

    context("updateDelegation", function() {
      it("cannot update delegation for candidates that are not in the list", async function() {       
        await expect(glmrDelegator.updateDelegation(candidate1.address, "1000000000000000000")).to.be.revertedWith(
          "GLMRDelegator._updateDelegation: candidate not in the list"
          );
      })

      it("can successfully update candiate delegations", async function() {
        await glmrDelegator.addCandidate(candidate1.address, "1000000000000000000");
        await glmrDelegator.addCandidate(candidate2.address, "2000000000000000000");
        await glmrDelegator.addCandidate(candidate3.address, "4000000000000000000");

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(3);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate3.address);
        expect(topList[1]).to.be.equal(candidate2.address);
        expect(topList[2]).to.be.equal(candidate1.address);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("1000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("2000000000000000000");
        expect(await glmrDelegator.delegations(candidate3.address)).to.be.equal("4000000000000000000");

        await glmrDelegator.updateDelegation(candidate1.address, "3000000000000000000");

        listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(3);
        topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate3.address);
        expect(topList[1]).to.be.equal(candidate1.address);
        expect(topList[2]).to.be.equal(candidate2.address);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("3000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("2000000000000000000");
        expect(await glmrDelegator.delegations(candidate3.address)).to.be.equal("4000000000000000000");

        await glmrDelegator.updateDelegation(candidate3.address, "5000000000000000000");

        listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(3);
        topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate3.address);
        expect(topList[1]).to.be.equal(candidate1.address);
        expect(topList[2]).to.be.equal(candidate2.address);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal("3000000000000000000");
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal("2000000000000000000");
        expect(await glmrDelegator.delegations(candidate3.address)).to.be.equal("5000000000000000000");
      })
    })
  })

  describe("Main Functions", function() {
    context("runDelegate", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runDelegate if not depositor", async function() {
        await expect(glmrDelegator.connect(player2).runDelegate(candidate1.address, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.onlyDepositor: permission denied"
          );
      })

      it("cannot runDelegate for zero candidate address", async function() {
        await expect(glmrDelegator.connect(player1).runDelegate(ZERO_ADDRESS, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.runDelegate: candidate cannot be zero address"
          );
      })

      it("cannot runDelegate for zero amount", async function() {
        await expect(glmrDelegator.connect(player1).runDelegate(candidate1.address, 0)).to.be.revertedWith(
          "GLMRDelegator.runDelegate: cannot delegate 0 amount"
          );
      })

      it("cannot runDelegate when no enough GLMRs in the delegator contract", async function() {
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: ethers.utils.parseEther("1.0")
        });

        await expect(glmrDelegator.connect(player1).runDelegate(candidate1.address, "6000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.runDelegate: no enought GLMRs"
          );
      })

      it("cannot runDelegate for a new candiate with amount less than min delegation", async function() {
        let minDelegation = await glmrDelegator.minDelegation();
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: minDelegation
        });

        await expect(glmrDelegator.connect(player1).runDelegate(candidate1.address, minDelegation.sub("1"))).to.be.revertedWith(
          "GLMRDelegator.runDelegate: need to meet the minimum delegation amount"
          );
      })

      it("can runDelegate for a new candidate", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        let beforeBal = await ethers.provider.getBalance(parachainStaking.address);
        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        let afterBal = await ethers.provider.getBalance(parachainStaking.address);

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(1);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount);
        expect(afterBal.sub(beforeBal)).to.be.equal(delegationAmount);
      })

      it("can runDelegate for an existing candidate", async function() {
        let initialDelegationAmount = ethers.utils.parseEther("5.0")
        let increasedDelegationAmount = ethers.utils.parseEther("2.0")

        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: initialDelegationAmount.add(increasedDelegationAmount)
        });
        await glmrDelegator.connect(player1).runDelegate(candidate1.address, initialDelegationAmount);

        let beforeBal = await ethers.provider.getBalance(parachainStaking.address);
        await glmrDelegator.connect(player1).runDelegate(candidate1.address, increasedDelegationAmount);
        let afterBal = await ethers.provider.getBalance(parachainStaking.address);

        let listSize = await glmrDelegator.listSize();
        expect(listSize).to.be.equal(1);
        let topList = await glmrDelegator.getTop(listSize);
        expect(topList[0]).to.be.equal(candidate1.address);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(initialDelegationAmount.add(increasedDelegationAmount));
        expect(await glmrDelegator.totalDelegated()).to.be.equal(initialDelegationAmount.add(increasedDelegationAmount));
        expect(afterBal.sub(beforeBal)).to.be.equal(increasedDelegationAmount);
      })

      it("can emit correct event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await expect(await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmount))
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(delegationAmount);
      })
    })

    context("runScheduleWithdraw", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runScheduleWithdraw if not depositor or assets manager", async function() {
        await expect(glmrDelegator.connect(player2).runScheduleWithdraw("3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.onlyDepositorOrAssetsManager: permission denied"
          );
      })

      it("cannot runScheduleWithdraw for zero amount", async function() {
        await expect(glmrDelegator.connect(owner).runScheduleWithdraw(0)).to.be.revertedWith(
          "GLMRDelegator.runScheduleWithdraw: cannot schedule withdraw 0 amount"
          );
      })

      it("cannot runScheduleWithdraw when no enough GLMRs are delegated", async function() {
        await expect(glmrDelegator.connect(owner).runScheduleWithdraw("1000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.runScheduleWithdraw: not enough GLMR delegated for withdraw"
          );
      })

      it("cannot runScheduleWithdraw when no enough GLMRs are withdrawable (due to min delegation)", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        await expect(glmrDelegator.connect(owner).runScheduleWithdraw(delegationAmount)).to.be.revertedWith(
          "GLMRDelegator.runScheduleWithdraw: not enough GLMR to schedule withdraw"
          );
      })

      it("can runScheduleWithdraw as a depositor", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);
        await glmrDelegator.connect(player1).runScheduleWithdraw(withdrawAmount);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(withdrawAmount);
      })

      it("can runScheduleWithdraw from a single candidate", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);
        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(withdrawAmount);
      })

      it("can runScheduleWithdraw from two different candidates", async function() {
        let delegationAmount = ethers.utils.parseEther("12.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount.div(2));
        await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmount.div(2));

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation).sub(minDelegation);
        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);

        let expectedDelegation = (delegationAmount.div(2)).sub(withdrawAmount.div(2));
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(expectedDelegation);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(expectedDelegation);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(withdrawAmount);
      })

      it("can emit TotalDelegatedUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await expect(await glmrDelegator.runScheduleWithdraw(withdrawAmount))
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(delegationAmount.sub(withdrawAmount));
      })

      it("can emit TotalPendingUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await expect(await glmrDelegator.runScheduleWithdraw(withdrawAmount))
          .to.emit(glmrDelegator, 'TotalPendingUpdated')
          .withArgs(withdrawAmount);
      })

    })

    context("runSingleScheduleWithdraw", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runScheduleWithdraw if not assets manager", async function() {
        await expect(glmrDelegator.connect(player2).runSingleScheduleWithdraw(candidate1.address, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runScheduleWithdraw if depositor", async function() {
        await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runSingleScheduleWithdraw for zero amount", async function() {
        await expect(glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, 0)).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw 0 amount"
          );
      })

      it("cannot runSingleScheduleWithdraw for zero candidate address", async function() {
        await expect(glmrDelegator.connect(owner).runSingleScheduleWithdraw(ZERO_ADDRESS, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleWithdraw: candidate cannot be zero address"
          );
      })

      it("cannot runSingleScheduleWithdraw for candidate not in the list", async function() {
        await expect(glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, "3000000000000000000")).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleWithdraw: candidate not in the delegation list"
          );
      })

      it("cannot runSingleScheduleWithdraw when no enough GLMRs are delegated for that candidate", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        await expect(glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, delegationAmount.add(1))).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleWithdraw: not enought delegated amount"
          );
      })

      it("cannot runSingleScheduleWithdraw one candidate below minimum delegation", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        
        let minDelegation = await glmrDelegator.minDelegation();
        await glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, delegationAmount.sub(minDelegation));

        await expect(glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, minDelegation)).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleWithdraw: cannot withdraw below minimun delegation"
          );
      })

      it("can successfully runSingleScheduleWithdraw", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);
        await glmrDelegator.connect(owner).runSingleScheduleWithdraw(candidate1.address, withdrawAmount);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await parachainStaking.totalAmountScheduled()).to.be.equal(withdrawAmount);
      })

      it("can emit TotalDelegatedUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await expect(glmrDelegator.runSingleScheduleWithdraw(candidate1.address, withdrawAmount))
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(delegationAmount.sub(withdrawAmount));
      })

      it("can emit TotalPendingUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await expect(glmrDelegator.runSingleScheduleWithdraw(candidate1.address, withdrawAmount))
          .to.emit(glmrDelegator, 'TotalPendingUpdated')
          .withArgs(withdrawAmount);
      })
    })

    context("runSingleScheduleRevoke", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runSingleScheduleRevoke if not assets manager", async function() {
        await expect(glmrDelegator.connect(player2).runSingleScheduleRevoke(candidate1.address)).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runSingleScheduleRevoke if depositor", async function() {
        await expect(glmrDelegator.connect(player1).runSingleScheduleRevoke(candidate1.address)).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runSingleScheduleRevoke for zero candidate address", async function() {
        await expect(glmrDelegator.connect(owner).runSingleScheduleRevoke(ZERO_ADDRESS)).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleRevoke: candidate cannot be zero address"
          );
      })

      it("cannot runSingleScheduleRevoke for candidate not in the list", async function() {
        await expect(glmrDelegator.connect(owner).runSingleScheduleRevoke(candidate1.address)).to.be.revertedWith(
          "GLMRDelegator.runSingleScheduleRevoke: candidate not in the delegation list"
          );
      })

      it("can successfully runSingleScheduleRevoke", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        await glmrDelegator.connect(owner).runSingleScheduleRevoke(candidate1.address);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(0);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(0);
        expect(await glmrDelegator.totalPending()).to.be.equal(delegationAmount);
      })

      it("can emit TotalDelegatedUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        await expect(glmrDelegator.connect(owner).runSingleScheduleRevoke(candidate1.address))
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(0);
      })

      it("can emit TotalPendingUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        await expect(glmrDelegator.connect(owner).runSingleScheduleRevoke(candidate1.address))
          .to.emit(glmrDelegator, 'TotalPendingUpdated')
          .withArgs(delegationAmount);
      })
    })

    context("runScheduleRevokeAll", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runScheduleRevokeAll if not assets manager", async function() {
        await expect(glmrDelegator.connect(player2).runScheduleRevokeAll()).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runScheduleRevokeAll if depositor", async function() {
        await expect(glmrDelegator.connect(player1).runScheduleRevokeAll()).to.be.revertedWith(
          "GLMRDelegator.onlyAssetsManager: permission denied"
          );
      })

      it("cannot runScheduleRevokeAll when no GLMRs are delegated", async function() {
        await expect(glmrDelegator.connect(owner).runScheduleRevokeAll()).to.be.revertedWith(
          "GLMRDelegator.runScheduleRevokeAll: no delegated GLMRs"
          );
      })

      it("can successfully runScheduleRevokeAll", async function() {
        let delegationAmountForCandidate1 = ethers.utils.parseEther("8.0")
        let delegationAmountForCandidate2 = ethers.utils.parseEther("10.0")

        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmountForCandidate1.add(delegationAmountForCandidate2)
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmountForCandidate1);
        await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmountForCandidate2);

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmountForCandidate1);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(delegationAmountForCandidate2);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmountForCandidate1.add(delegationAmountForCandidate2));

        await glmrDelegator.connect(owner).runScheduleRevokeAll();

        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(0);
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(0);

        expect(await glmrDelegator.totalDelegated()).to.be.equal(0);
        expect(await glmrDelegator.totalPending()).to.be.equal(delegationAmountForCandidate1.add(delegationAmountForCandidate2));
      })

      it("can emit TotalDelegatedUpdated event", async function() {
        let delegationAmountForCandidate1 = ethers.utils.parseEther("8.0")
        let delegationAmountForCandidate2 = ethers.utils.parseEther("10.0")

        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmountForCandidate1.add(delegationAmountForCandidate2)
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmountForCandidate1);
        await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmountForCandidate2);

        await expect(glmrDelegator.connect(owner).runScheduleRevokeAll())
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(0);
      })

      it("can emit TotalPendingUpdated event", async function() {
        let delegationAmountForCandidate1 = ethers.utils.parseEther("8.0")
        let delegationAmountForCandidate2 = ethers.utils.parseEther("10.0")

        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmountForCandidate1.add(delegationAmountForCandidate2)
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmountForCandidate1);
        await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmountForCandidate2);

        await expect(glmrDelegator.connect(owner).runScheduleRevokeAll())
          .to.emit(glmrDelegator, 'TotalPendingUpdated')
          .withArgs(delegationAmountForCandidate1.add(delegationAmountForCandidate2));
      })
    })

    context("runWithdraw", function() {
      beforeEach(async () => {
        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
      })

      it("cannot runWithdraw if not depositor or assets manager", async function() {
        await expect(glmrDelegator.connect(player2).runWithdraw(player1.address, "3000000000000000000", false)).to.be.revertedWith(
          "GLMRDelegator.onlyDepositorOrAssetsManager: permission denied"
          );
      })

      it("cannot runWithdraw for zero receiver address", async function() {
        await expect(glmrDelegator.connect(owner).runWithdraw(ZERO_ADDRESS, "3000000000000000000", false)).to.be.revertedWith(
          "GLMRDelegator.runWithdraw: receiver cannot be zero address"
          );
      })

      it("cannot runWithdraw for zero amount", async function() {
        await expect(glmrDelegator.connect(owner).runWithdraw(player1.address, 0, false)).to.be.revertedWith(
          "GLMRDelegator.runWithdraw: cannot withdraw 0 amount"
          );
      })

      it("cannot runWithdraw when no enough GLMRs", async function() {
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: ethers.utils.parseEther("1.0")
        });

        await expect(glmrDelegator.connect(owner).runWithdraw(player1.address, "2000000000000000000", false)).to.be.revertedWith(
          "GLMRDelegator.runWithdraw: no enough GLMRs"
          );
      })

      it("cannot runWithdraw when no enough pending GLMRs", async function() {
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: ethers.utils.parseEther("2.0")
        });

        await expect(glmrDelegator.connect(owner).runWithdraw(player1.address, "2000000000000000000", false)).to.be.revertedWith(
          "GLMRDelegator.runWithdraw: no enough pending GLMRs"
          );
      })

      it("can runWithdraw but not redelegate", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);
        await glmrDelegator.connect(owner).executeDelegationRequest(glmrDelegator.address, candidate1.address);
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);

        let beforeBal = await ethers.provider.getBalance(player1.address);
        await glmrDelegator.connect(owner).runWithdraw(player1.address, withdrawAmount, false);
        let afterBal = await ethers.provider.getBalance(player1.address);

        expect(afterBal.sub(beforeBal)).to.be.equal(withdrawAmount);
        expect(await glmrDelegator.totalPending()).to.be.equal(0);

      })

      it("can runWithdraw but not redelegate", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);
        await glmrDelegator.connect(owner).executeDelegationRequest(glmrDelegator.address, candidate1.address);
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);

        let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);

        let beforeBal = await ethers.provider.getBalance(player2.address);
        await glmrDelegator.connect(player1).runWithdraw(player2.address, withdrawAmount, false);
        let afterBal = await ethers.provider.getBalance(player2.address);

        expect(afterBal.sub(beforeBal)).to.be.equal(withdrawAmount);
        expect(await glmrDelegator.totalPending()).to.be.equal(0);
      })

      it("can emit TotalPendingUpdated event", async function() {
        let delegationAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);
        await glmrDelegator.connect(owner).executeDelegationRequest(glmrDelegator.address, candidate1.address);
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));

        await expect(glmrDelegator.connect(owner).runWithdraw(player1.address, withdrawAmount, false))
          .to.emit(glmrDelegator, 'TotalPendingUpdated')
          .withArgs(0);
      })

      it("can runWithdraw and redelegate", async function() {
        let delegationAmount = ethers.utils.parseEther("20.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);
        await glmrDelegator.connect(owner).executeDelegationRequest(glmrDelegator.address, candidate1.address);
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));

        await glmrDelegator.connect(owner).runWithdraw(candidate2.address, withdrawAmount, true);

        expect(await glmrDelegator.totalPending()).to.be.equal(0);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount);
        expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(withdrawAmount));
        expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(withdrawAmount);
      })

      it("can emit TotalDelegatedUpdated event when redelegate", async function() {
        let delegationAmount = ethers.utils.parseEther("20.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: delegationAmount
        });

        await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount);

        let minDelegation = await glmrDelegator.minDelegation();
        let withdrawAmount = delegationAmount.sub(minDelegation);

        await glmrDelegator.connect(owner).runScheduleWithdraw(withdrawAmount);
        await glmrDelegator.connect(owner).executeDelegationRequest(glmrDelegator.address, candidate1.address);
        expect(await glmrDelegator.totalPending()).to.be.equal(withdrawAmount);
        expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));

        await expect(glmrDelegator.connect(owner).runWithdraw(candidate2.address, withdrawAmount, true))
          .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
          .withArgs(delegationAmount);
      })

    })

    context("harvest", function() {
      beforeEach(async () => {
        let rewardCollectorRole = await glmrDelegator.REWARD_COLLECTOR_ROLE();
        await glmrDelegator.connect(owner).grantRole(rewardCollectorRole, player1.address);
      })

      it("cannot run harvest if not reward collector", async function() {
        await expect(glmrDelegator.connect(player2).harvest(player2.address)).to.be.revertedWith(
          "GLMRDelegator.onlyRewardCollector: permission denied"
          );
      })

      it("cannot harvest for zero receiver address", async function() {
        await expect(glmrDelegator.connect(player1).harvest(ZERO_ADDRESS)).to.be.revertedWith(
          "GLMRDelegator.harvest: receiver cannot be zero address"
          );
      })

      it("can successfully harvest", async function() {
        let harvestAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: harvestAmount
        });

        expect(await glmrDelegator.availabeToHarvest()).to.be.equal(harvestAmount);

        let beforeBal = await ethers.provider.getBalance(player2.address);
        await glmrDelegator.connect(player1).harvest(player2.address);
        let afterBal = await ethers.provider.getBalance(player2.address);
        
        expect(afterBal.sub(beforeBal)).to.be.equal(harvestAmount);
      })

      it("can emit RewardsHarvested event", async function() {
        let harvestAmount = ethers.utils.parseEther("8.0")
        await owner.sendTransaction({
          to: glmrDelegator.address,
          value: harvestAmount
        });

        await expect(glmrDelegator.connect(player1).harvest(player1.address))
          .to.emit(glmrDelegator, 'RewardsHarvested')
          .withArgs(player1.address, harvestAmount);
      })
    })
  })
});