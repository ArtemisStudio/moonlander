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
      context("No depositor role", function() {
        it("cannot runDelegate if not depositor", async function() {
          await expect(glmrDelegator.connect(player1).runDelegate(candidate1.address, "3000000000000000000")).to.be.revertedWith(
            "GLMRDelegator.onlyDepositor: permission denied"
            );
        })
      })

      context("Has depositor role", function() {
        beforeEach(async () => {
          let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
        })

        it("cannot runDelegate if paused", async function() {
          await glmrDelegator.connect(owner).pause();
          await expect(glmrDelegator.connect(player1).runDelegate(candidate1.address, "3000000000000000000")).to.be.revertedWith(
            "Pausable: paused"
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
            "GLMRDelegator.runDelegate: no enough GLMRs"
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
  
        it("can emit correct event for a new candidate", async function() {
          let delegationAmount = ethers.utils.parseEther("8.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: delegationAmount
          });
  
          await expect(await glmrDelegator.connect(player1).runDelegate(candidate2.address, delegationAmount))
            .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
              .withArgs(delegationAmount)
            .to.emit(glmrDelegator, 'DelegatorDelegated')
              .withArgs(candidate2.address, delegationAmount)
            .to.emit(glmrDelegator, 'CandidateAdded')
              .withArgs(candidate2.address, delegationAmount);
        })
  
        it("can emit correct event for an existing candidate", async function() {
          let initialDelegationAmount = ethers.utils.parseEther("5.0")
          let increasedDelegationAmount = ethers.utils.parseEther("2.0")
  
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: initialDelegationAmount.add(increasedDelegationAmount)
          });
          await glmrDelegator.connect(player1).runDelegate(candidate1.address, initialDelegationAmount);
  
          await expect(await glmrDelegator.connect(player1).runDelegate(candidate1.address, increasedDelegationAmount))
            .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
              .withArgs(initialDelegationAmount.add(increasedDelegationAmount))
            .to.emit(glmrDelegator, 'DelegatorBondMore')
              .withArgs(candidate1.address, increasedDelegationAmount)
            .to.emit(glmrDelegator, 'DelegationIncreased')
              .withArgs(candidate1.address, increasedDelegationAmount);
        })
      })
    })

    context("runSingleScheduleWithdraw", function() {
      context("No depositor role", function() {
        it("Cannot runSingleScheduleWithdraw if not depositor", async function () {
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, "3000000000000000000")).to.be.revertedWith(
            "GLMRDelegator.onlyDepositor: permission denied"
            );
        })
      })

      context("Has depositor role", function() {
        beforeEach(async () => {
          let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
        })

        it("cannot runSingleScheduleWithdraw if paused", async function() {
          await glmrDelegator.connect(owner).pause();
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, 0)).to.be.revertedWith(
            "Pausable: paused"
            );
        })

        it("cannot runSingleScheduleWithdraw for zero amount", async function() {
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, 0)).to.be.revertedWith(
            "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw 0 amount"
            );
        })

        it("cannot runSingleScheduleWithdraw for zero candidate address", async function() {
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(ZERO_ADDRESS, "3000000000000000000")).to.be.revertedWith(
            "GLMRDelegator.runSingleScheduleWithdraw: candidate cannot be zero address"
            );
        })

        it("cannot runSingleScheduleWithdraw for candidate not in the list", async function() {
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, "3000000000000000000")).to.be.revertedWith(
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
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, delegationAmount.add(1))).to.be.revertedWith(
            "GLMRDelegator.runSingleScheduleWithdraw: not enough GLMR delegated"
            );
        })

        it("cannot runSingleScheduleWithdraw one candidate below minimum delegation but not revoke", async function() {
          let delegationAmount = ethers.utils.parseEther("8.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: delegationAmount
          });
  
          await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
          
          let minDelegation = await glmrDelegator.minDelegation();
          await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, delegationAmount.sub(minDelegation));
  
          await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, minDelegation.sub(1))).to.be.revertedWith(
            "GLMRDelegator.runSingleScheduleWithdraw: cannot schedule withdraw below minimum delegation without revoke"
            );
        })

        context("Withdraw case", function() {
          let delegationAmount = ethers.utils.parseEther("8.0")

          beforeEach(async () => {
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });
    
            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
          })

          it("can successfully runSingleScheduleWithdraw", async function() {
            let minDelegation = await glmrDelegator.minDelegation();
            let withdrawAmount = delegationAmount.sub(minDelegation);
            await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, withdrawAmount);
    
            expect(await glmrDelegator.candidateExist(candidate1.address)).to.be.equal(true);
            expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(withdrawAmount));
            expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(withdrawAmount));
            expect(await glmrDelegator.totalScheduled()).to.be.equal(withdrawAmount);
            expect(await parachainStaking.amountScheduled(candidate1.address)).to.be.equal(withdrawAmount);
            expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(1);
            expect(await glmrDelegator.pendingCandidates(0)).to.be.equal(candidate1.address);
            expect(await glmrDelegator.candidateWithPendingRequest(candidate1.address)).to.be.equal(true);
          })

          it("can emit correct event", async function() {
            let minDelegation = await glmrDelegator.minDelegation();
            let withdrawAmount = delegationAmount.sub(minDelegation);
    
            await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, withdrawAmount))
              .to.emit(glmrDelegator, 'DelegatorLessBonded')
                .withArgs(candidate1.address, withdrawAmount)
              .to.emit(glmrDelegator, 'DelegationReduced')
                .withArgs(candidate1.address, withdrawAmount)
              .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
                .withArgs(delegationAmount.sub(withdrawAmount))
              .to.emit(glmrDelegator, 'TotalScheduledUpdated')
                .withArgs(withdrawAmount);
          })
        })

        context("Withdraw case", function() {
          let delegationAmount = ethers.utils.parseEther("8.0")

          beforeEach(async () => {
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });
    
            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
          })

          it("can successfully runSingleScheduleWithdraw to revoke single candidate when withdraw all delegation amount for single candidate", async function() {
            await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, delegationAmount);
    
            expect(await glmrDelegator.candidateExist(candidate1.address)).to.be.equal(false);
            expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(0);
            expect(await glmrDelegator.totalDelegated()).to.be.equal(0);
            expect(await glmrDelegator.totalScheduled()).to.be.equal(delegationAmount);
            expect(await parachainStaking.amountScheduled(candidate1.address)).to.be.equal(delegationAmount);
            expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(1);
            expect(await glmrDelegator.pendingCandidates(0)).to.be.equal(candidate1.address);
            expect(await glmrDelegator.candidateWithPendingRequest(candidate1.address)).to.be.equal(true);
          })

          it("can emit correct event", async function() {
            await expect(glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, delegationAmount))
              .to.emit(glmrDelegator, 'DelegatorRevokeScheduled')
                .withArgs(candidate1.address)
              .to.emit(glmrDelegator, 'CandidateRemoved')
                .withArgs(candidate1.address)
              .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
                .withArgs(0)
              .to.emit(glmrDelegator, 'TotalScheduledUpdated')
                .withArgs(delegationAmount);
          })
        })
      })
    })

    context("runExecuteAllDelegationRequests", function() {
      context("No depositor role", function() {
        it("Cannot runExecuteAllDelegationRequests if not depositor", async function () {
          await expect(glmrDelegator.connect(player1).runExecuteAllDelegationRequests()).to.be.revertedWith(
            "GLMRDelegator.onlyDepositor: permission denied"
            );
        })
      })

      context("Has depositor role", function() {
        beforeEach(async () => {
          let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
        })

        it("cannot runExecuteAllDelegationRequests if paused", async function() {
          await glmrDelegator.connect(owner).pause();
          await expect(glmrDelegator.connect(player1).runExecuteAllDelegationRequests()).to.be.revertedWith(
            "Pausable: paused"
            );
        })

        it("can runExecuteAllDelegationRequests when no pendingCandidates", async function() {
          expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(0);
          await glmrDelegator.connect(player1).runExecuteAllDelegationRequests();
          expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(0);
        })

        it("can successfully execute delegation request for pending candidates", async function() {
          let candidate1DelegationAmount = ethers.utils.parseEther("8.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: candidate1DelegationAmount
          });
  
          await glmrDelegator.connect(player1).runDelegate(candidate1.address, candidate1DelegationAmount);
  
          let candidate2DelegationAmount = ethers.utils.parseEther("10.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: candidate2DelegationAmount
          });

          await glmrDelegator.connect(player1).runDelegate(candidate2.address, candidate2DelegationAmount);

          let minDelegation = await glmrDelegator.minDelegation();
          let candidate1WithdrawAmount = candidate1DelegationAmount.sub(minDelegation);
          await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, candidate1WithdrawAmount);
          await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate2.address, candidate2DelegationAmount);

          expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(2);
          expect(await glmrDelegator.candidateWithPendingRequest(candidate1.address)).to.be.equal(true);
          expect(await glmrDelegator.candidateWithPendingRequest(candidate2.address)).to.be.equal(true);

          await glmrDelegator.connect(player1).runExecuteAllDelegationRequests();

          expect(await glmrDelegator.getPendingCandidatesLength()).to.be.equal(0);
          expect(await glmrDelegator.candidateWithPendingRequest(candidate1.address)).to.be.equal(false);
          expect(await glmrDelegator.candidateWithPendingRequest(candidate2.address)).to.be.equal(false);
        })

        it("can emit DelegationRequestExecuted event", async function() {
          let candidate1DelegationAmount = ethers.utils.parseEther("8.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: candidate1DelegationAmount
          });
  
          await glmrDelegator.connect(player1).runDelegate(candidate1.address, candidate1DelegationAmount);
  
          let candidate2DelegationAmount = ethers.utils.parseEther("10.0")
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: candidate2DelegationAmount
          });

          await glmrDelegator.connect(player1).runDelegate(candidate2.address, candidate2DelegationAmount);

          let minDelegation = await glmrDelegator.minDelegation();
          let candidate1WithdrawAmount = candidate1DelegationAmount.sub(minDelegation);
          await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, candidate1WithdrawAmount);
          await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate2.address, candidate2DelegationAmount);

          await expect(glmrDelegator.connect(player1).runExecuteAllDelegationRequests())
            .to.emit(glmrDelegator, 'DelegationRequestExecuted')
            .withArgs(candidate1.address)
            .to.emit(glmrDelegator, 'DelegationRequestExecuted')
            .withArgs(candidate2.address);
        })
      })
    })

    context("runWithdraw", function() {

      context("No depositor role", function() {
        it("cannot runWithdraw if not depositor", async function() {
          await expect(glmrDelegator.connect(player1).runWithdraw(player1.address, "3000000000000000000", false)).to.be.revertedWith(
            "GLMRDelegator.onlyDepositor: permission denied"
            );
        })
      })

      context("Has depositor role", function() {
        beforeEach(async () => {
          let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
        })

        it("cannot runWithdraw if paused", async function() {
          await glmrDelegator.connect(owner).pause();
          await expect(glmrDelegator.connect(player1).runWithdraw(player1.address, 10, false)).to.be.revertedWith(
            "Pausable: paused"
            );
        })

        it("cannot runWithdraw for zero receiver address", async function() {
          await expect(glmrDelegator.connect(player1).runWithdraw(ZERO_ADDRESS, "3000000000000000000", false)).to.be.revertedWith(
            "GLMRDelegator.runWithdraw: receiver cannot be zero address"
            );
        })

        it("cannot runWithdraw for zero amount", async function() {
          await expect(glmrDelegator.connect(player1).runWithdraw(player1.address, 0, false)).to.be.revertedWith(
            "GLMRDelegator.runWithdraw: cannot withdraw 0 amount"
            );
        })

        it("cannot runWithdraw when no enough GLMRs", async function() {
          let glmrAmount = ethers.utils.parseEther("1.0")

          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: glmrAmount
          });
  
          await expect(glmrDelegator.connect(player1).runWithdraw(player1.address, glmrAmount.add(1), false)).to.be.revertedWith(
            "GLMRDelegator.runWithdraw: no enough GLMRs"
            );
        })

        it("cannot runWithdraw when no enough scheduled GLMRs", async function() {
          let glmrAmount = ethers.utils.parseEther("2.0")

          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: glmrAmount
          });
  
          await expect(glmrDelegator.connect(player1).runWithdraw(player1.address, glmrAmount, false)).to.be.revertedWith(
            "GLMRDelegator.runWithdraw: no enough scheduled GLMRs"
            );
        })

        context("withdraw case", function() {
          let delegationAmount;
          let scheduledWithdrawAmount;

          beforeEach(async () => {
            delegationAmount = ethers.utils.parseEther("8.0");
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });
    
            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
    
            let minDelegation = await glmrDelegator.minDelegation();
            scheduledWithdrawAmount = delegationAmount.sub(minDelegation);
    
            await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, scheduledWithdrawAmount);
            await glmrDelegator.connect(player1).runExecuteAllDelegationRequests();
          })

          it("can runWithdraw but not redelegate", async function() {
            expect(await glmrDelegator.totalScheduled()).to.be.equal(scheduledWithdrawAmount);

            let withdrawAmount = scheduledWithdrawAmount.div(2);

            let beforeBal = await ethers.provider.getBalance(player2.address);
            await glmrDelegator.connect(player1).runWithdraw(player2.address, withdrawAmount, false);
            let afterBal = await ethers.provider.getBalance(player2.address);
    
            expect(afterBal.sub(beforeBal)).to.be.equal(withdrawAmount);
            expect(await glmrDelegator.totalScheduled()).to.be.equal(scheduledWithdrawAmount.sub(withdrawAmount));
          })

          it("can emit correct event", async function() {
            let withdrawAmount = scheduledWithdrawAmount.div(2);

            await expect(glmrDelegator.connect(player1).runWithdraw(player2.address, withdrawAmount, false))
              .to.emit(glmrDelegator, 'TotalScheduledUpdated')
                .withArgs(scheduledWithdrawAmount.sub(withdrawAmount));
          })
        })

        context("redelegate case", function() {
          let delegationAmount;
          let scheduledWithdrawAmount;

          beforeEach(async () => {
            delegationAmount = ethers.utils.parseEther("20.0");
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });
    
            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
    
            let minDelegation = await glmrDelegator.minDelegation();
            scheduledWithdrawAmount = delegationAmount.sub(minDelegation);
    
            await glmrDelegator.connect(player1).runSingleScheduleWithdraw(candidate1.address, scheduledWithdrawAmount);
            await glmrDelegator.connect(player1).runExecuteAllDelegationRequests();
          })

          it("cannot runWithdraw and redelegate to a new candidate if lower than minimum delegation", async function() {
            let minDelegation = await glmrDelegator.minDelegation();

            let redelegateAmount = minDelegation.sub(1);
    
            await expect(glmrDelegator.connect(player1).runWithdraw(candidate2.address, redelegateAmount, true)).to.be.revertedWith(
              "GLMRDelegator.runWithdraw: need to meet the minimum delegation amount"
              );
          })

          it("can runWithdraw and redelegate to a new candidate", async function() {
            let minDelegation = await glmrDelegator.minDelegation();
            let redelegateAmount = minDelegation.add(1);

            await glmrDelegator.connect(player1).runWithdraw(candidate2.address, redelegateAmount, true);
    
            expect(await glmrDelegator.totalScheduled()).to.be.equal(scheduledWithdrawAmount.sub(redelegateAmount));
            expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(scheduledWithdrawAmount).add(redelegateAmount));
            expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(scheduledWithdrawAmount));
            expect(await glmrDelegator.delegations(candidate2.address)).to.be.equal(redelegateAmount);
          })

          it("can emit correct event when redelegate to a new candidate", async function() {
            let redelegateAmount = scheduledWithdrawAmount.div(2);

            await expect(glmrDelegator.connect(player1).runWithdraw(candidate2.address, redelegateAmount, true))
              .to.emit(glmrDelegator, 'DelegatorDelegated')
                .withArgs(candidate2.address, redelegateAmount)
              .to.emit(glmrDelegator, 'CandidateAdded')
                .withArgs(candidate2.address, redelegateAmount)
              .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
                .withArgs(delegationAmount.sub(scheduledWithdrawAmount).add(redelegateAmount))
              .to.emit(glmrDelegator, 'TotalScheduledUpdated')
                .withArgs(scheduledWithdrawAmount.sub(redelegateAmount));
          })

          it("can runWithdraw and redelegate to an existing candidate", async function() {
            let minDelegation = await glmrDelegator.minDelegation();
            let redelegateAmount = minDelegation.add(1);

            await glmrDelegator.connect(player1).runWithdraw(candidate1.address, redelegateAmount, true);
    
            expect(await glmrDelegator.totalScheduled()).to.be.equal(scheduledWithdrawAmount.sub(redelegateAmount));
            expect(await glmrDelegator.totalDelegated()).to.be.equal(delegationAmount.sub(scheduledWithdrawAmount).add(redelegateAmount));
            expect(await glmrDelegator.delegations(candidate1.address)).to.be.equal(delegationAmount.sub(scheduledWithdrawAmount).add(redelegateAmount));
          })

          it("can emit correct event when redelegate to a new candidate", async function() {
            let redelegateAmount = scheduledWithdrawAmount.div(2);

            await expect(glmrDelegator.connect(player1).runWithdraw(candidate1.address, redelegateAmount, true))
              .to.emit(glmrDelegator, 'DelegatorMoreBonded')
                .withArgs(candidate1.address, redelegateAmount)
              .to.emit(glmrDelegator, 'DelegationIncreased')
                .withArgs(candidate1.address, redelegateAmount)
              .to.emit(glmrDelegator, 'TotalDelegatedUpdated')
                .withArgs(delegationAmount.sub(scheduledWithdrawAmount).add(redelegateAmount))
              .to.emit(glmrDelegator, 'TotalScheduledUpdated')
                .withArgs(scheduledWithdrawAmount.sub(redelegateAmount));
          })
        })

      })
    })

    context("harvest", function() {

      context("No reward collector role", function() {
        it("cannot run harvest if not reward collector", async function() {
          await expect(glmrDelegator.connect(player1).harvest(player1.address)).to.be.revertedWith(
            "GLMRDelegator.onlyRewardCollector: permission denied"
            );
        })
      })

      context("Has reward collector role", function() {
        beforeEach(async () => {
          let rewardCollectorRole = await glmrDelegator.REWARD_COLLECTOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(rewardCollectorRole, player1.address);
        })

        it("cannot harvest if paused", async function() {
          await glmrDelegator.connect(owner).pause();
          await expect(glmrDelegator.connect(player1).harvest(player1.address)).to.be.revertedWith(
            "Pausable: paused"
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
  
          expect(await glmrDelegator.availableToHarvest()).to.be.equal(harvestAmount);
  
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
  })

  describe("Emergency Functions", function() { 
    context("runEmergencyRecall", function() {
      context("No depositor role", function() {
        it("Cannot runEmergencyRecall if not depositor", async function () {
          await expect(glmrDelegator.connect(player1).runEmergencyRecall(player1.address)).to.be.revertedWith(
            "GLMRDelegator.onlyDepositor: permission denied"
            );
        })
      })
  
      context("Has depositor role", function() {
        let delegationAmount
        beforeEach(async () => {
          let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
          await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
          delegationAmount = ethers.utils.parseEther("8.0");
          await owner.sendTransaction({
            to: glmrDelegator.address,
            value: delegationAmount
          });
        })

        context("When not paused", function() {
          it("Cannot runEmergencyRecall if not paused", async function () {
            await expect(glmrDelegator.connect(player1).runEmergencyRecall(player1.address)).to.be.revertedWith(
                "Pausable: not paused"
              );
          })
        })

        context("When paused", function() {
          beforeEach(async () => {
            let adminRole = await glmrDelegator.ADMIN_ROLE();
            await glmrDelegator.connect(owner).grantRole(adminRole, player1.address);
            await glmrDelegator.connect(player1).pause();
          })

          it("Can successfully runEmergencyRecall", async function () {
            let beforeBal = await ethers.provider.getBalance(player1.address);
            await glmrDelegator.connect(player1).runEmergencyRecall(player1.address);
            let afterBal = await ethers.provider.getBalance(player1.address);
            expect(afterBal.sub(beforeBal)).to.be.within(delegationAmount.sub(ethers.utils.parseEther("1.0")), delegationAmount);
          })
        })
      })
    })

    context("scheduleRevokeDelegation", function() {
      context("No admin role", function() {
        it("Cannot scheduleRevokeDelegation if not admin", async function () {
          await expect(glmrDelegator.connect(player1).scheduleRevokeDelegation(candidate1.address)).to.be.revertedWith(
            "GLMRDelegator.onlyAdmin: permission denied"
            );
        })
      })
  
      context("Has admin role", function() {
        let delegationAmount
        beforeEach(async () => {
          let adminRole = await glmrDelegator.ADMIN_ROLE();
          await glmrDelegator.connect(owner).grantRole(adminRole, player1.address);
        })

        context("When not paused", function() {
          it("Cannot scheduleRevokeDelegation if not paused", async function () {
            await expect(glmrDelegator.connect(player1).scheduleRevokeDelegation(candidate1.address)).to.be.revertedWith(
                "Pausable: not paused"
              );
          })
        })

        context("When paused", function() {
          beforeEach(async () => {
            let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
            await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
            delegationAmount = ethers.utils.parseEther("8.0");
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });

            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
            await glmrDelegator.connect(player1).pause();
          })

          it("Can successfully scheduleRevokeDelegation", async function () {
            expect(await parachainStaking.amountScheduled(candidate1.address)).to.be.equal(0);
            await glmrDelegator.connect(player1).scheduleRevokeDelegation(candidate1.address);
            expect(await parachainStaking.amountScheduled(candidate1.address)).to.be.equal(delegationAmount);
          })
        })
      })
    })

    context("executeDelegationRequest", function() {
      context("No admin role", function() {
        it("Cannot executeDelegationRequest if not admin", async function () {
          await expect(glmrDelegator.connect(player1).executeDelegationRequest(candidate1.address)).to.be.revertedWith(
            "GLMRDelegator.onlyAdmin: permission denied"
            );
        })
      })
  
      context("Has admin role", function() {
        let delegationAmount
        beforeEach(async () => {
          let adminRole = await glmrDelegator.ADMIN_ROLE();
          await glmrDelegator.connect(owner).grantRole(adminRole, player1.address);
        })

        context("When not paused", function() {
          it("Cannot executeDelegationRequest if not paused", async function () {
            await expect(glmrDelegator.connect(player1).executeDelegationRequest(candidate1.address)).to.be.revertedWith(
                "Pausable: not paused"
              );
          })
        })

        context("When paused", function() {
          beforeEach(async () => {
            let depositorRole = await glmrDelegator.DEPOSITOR_ROLE();
            await glmrDelegator.connect(owner).grantRole(depositorRole, player1.address);
            delegationAmount = ethers.utils.parseEther("8.0");
            await owner.sendTransaction({
              to: glmrDelegator.address,
              value: delegationAmount
            });

            await glmrDelegator.connect(player1).runDelegate(candidate1.address, delegationAmount);
            await glmrDelegator.connect(player1).pause();
            await glmrDelegator.connect(player1).scheduleRevokeDelegation(candidate1.address);
          })

          it("Can successfully executeDelegationRequest", async function () {
            let beforeBal = await ethers.provider.getBalance(glmrDelegator.address);
            await glmrDelegator.connect(player1).executeDelegationRequest(candidate1.address);
            let afterBal = await ethers.provider.getBalance(glmrDelegator.address);
            expect(afterBal.sub(beforeBal)).to.be.equal(delegationAmount);
          })
        })
      })
    })
  })
});