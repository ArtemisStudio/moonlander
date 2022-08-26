const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ADDRESS_ZERO } = require("./utilities");
const { advanceTimeAndBlock, advanceBlockTo, latest, duration, increase } = require("./utilities/time");


const reward = (sec, percent) => {
    return (sec * this.landerPerSec * percent) / 1000;
}

describe("StakingPools", function () {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.carol = this.signers[2]
        this.landerSource = this.signers[3]
        this.mockZapper = this.signers[4]
        this.minter = this.signers[6]
        this.dev = this.signers[7]
        

        this.MCV2 = await ethers.getContractFactory("StakingPools")
        this.SimpleRewarderPerSec = await ethers.getContractFactory("SimpleRewarderPerSec")
        this.ERC20Mock = await ethers.getContractFactory("MockERC20", this.minter)


        this.landerPerSec = 100
        this.secOffset = 1
        this.tokenOffset = 1

        this.extraRewardPerSec = 40


    })

    beforeEach(async function () {
        this.lander = await this.ERC20Mock.deploy("Lander Token", "LANDER") // b=1
        await this.lander.deployed()

        this.extraRewardToken = await this.ERC20Mock.deploy("Partner Token", "PARTNER") // b=2
        await this.extraRewardToken.deployed()
    })


    //   constructor(
    //     address _lander,
    //     uint256 _landerPerSec,
    //     uint256 _startTimestamp,
    //     address _landerRewardSource,
    //     address _zapperAddress
    // )

    it("should set correct state variables", async function () {
        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.MCV2.deploy(
            this.lander.address,
            this.landerPerSec,
            startTime,
            this.landerSource.address,
            this.mockZapper.address
        )
        await this.chef.deployed()


        const lander = await this.chef.lander();
        const landerSource = await this.chef.landerRewardSource();
        const zapper = await this.chef.zapperAddress();

        expect(lander).to.equal(this.lander.address)
        expect(landerSource).to.equal(this.landerSource.address)
        expect(zapper).to.equal(this.mockZapper.address)

    })



    context("With ERC/LP token added to the field and using SimpleRewarderPerSec", function () {
        beforeEach(async function () {
            this.lp = await this.ERC20Mock.deploy("LPToken", "LP")

            await this.lp.mint(this.alice.address, "1000")
            await this.lp.mint(this.bob.address, "1000")
            await this.lp.mint(this.carol.address, "1000")

            await this.lp.mint(this.mockZapper.address, "1000")

            this.lp2 = await this.ERC20Mock.deploy("LPToken2", "LP2")
            await this.lp2.mint(this.alice.address, "1000")
            await this.lp2.mint(this.bob.address, "1000")
            await this.lp2.mint(this.carol.address, "1000")

            await this.lp2.mint(this.mockZapper.address, "1000")

        })

        it("should check rewarder's arguments are contracts", async function () {
            await expect(
                this.SimpleRewarderPerSec.deploy(ADDRESS_ZERO, this.lp.address, this.extraRewardPerSec, this.chef.address, false)
            ).to.be.revertedWith("constructor: reward token must be a valid contract")

            await expect(
                this.SimpleRewarderPerSec.deploy(this.extraRewardToken.address, ADDRESS_ZERO, this.extraRewardPerSec, this.chef.address, false)
            ).to.be.revertedWith("constructor: LP token must be a valid contract")

            await expect(
                this.SimpleRewarderPerSec.deploy(this.extraRewardToken.address, this.lp.address, this.extraRewardPerSec, ADDRESS_ZERO, false)
            ).to.be.revertedWith("constructor: MasterChefLander must be a valid contract")
        })

        it("should check rewarder added and set properly", async function () {
            const startTime = (await latest()).add(60)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed()


            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed()

            // Try to add rewarder that is neither zero address or contract address
            await expect(this.chef.add("100", this.lp.address, this.dev.address)).to.be.revertedWith("add: rewarder must be contract or zero")

            await this.chef.add("100", this.lp.address, this.rewarder.address)

            // Try to set rewarder that is neither zero address or contract address
            await expect(this.chef.set("0", "200", this.dev.address, true)).to.be.revertedWith("set: rewarder must be contract or zero")

            await this.chef.set("0", "200", this.rewarder.address, false)
            expect((await this.chef.poolInfo(0)).allocPoint).to.equal("200")
        })

        it("should allow a given pool's allocation weight and rewarder to be updated", async function () {
            const startTime = (await latest()).add(60)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed()

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed()

            await this.chef.add("100", this.lp.address, ADDRESS_ZERO)
            expect((await this.chef.poolInfo(0)).allocPoint).to.equal("100")
            expect((await this.chef.poolInfo(0)).rewarder).to.equal(ADDRESS_ZERO)

            await this.chef.set("0", "150", this.rewarder.address, true)
            expect((await this.chef.poolInfo(0)).allocPoint).to.equal("150")
            expect((await this.chef.poolInfo(0)).rewarder).to.equal(this.rewarder.address)
        })

        it("should allow emergency withdraw from rewarder contract", async function () {
            // ERC-20
            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed()

            await this.extraRewardToken.mint(this.rewarder.address, "1000000")
            await this.rewarder.emergencyWithdraw()
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.equal("1000000")

            // AVAX
            this.rewarderAVAX = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                true
            )
            await this.rewarderAVAX.deployed()

            const rewardAmount = ethers.utils.parseEther("10")
            const tx = { to: this.rewarderAVAX.address, value: rewardAmount }
            await this.bob.sendTransaction(tx)
            const bal = await ethers.provider.getBalance(this.rewarderAVAX.address)
            expect(bal).to.equal(rewardAmount)
            const aliceBalBefore = await this.alice.getBalance()
            await this.rewarderAVAX.emergencyWithdraw()
            const aliceBalAfter = await this.alice.getBalance()
            expect(aliceBalAfter.sub(aliceBalBefore)).to.lt(rewardAmount)
        })

        it("should reward partner token accurately after rewarder runs out of tokens and is topped up again", async function () {
            const startTime = (await latest()).add(60)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "80") // t-57

            await this.lander.mint(this.chef.address, "0") // t-56, just to advance time

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55

            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await this.chef.connect(this.bob).deposit(0, "100") // t-53
            await advanceTimeAndBlock(4) // t-49

            await this.chef.connect(this.bob).deposit(0, "0") // t-48
            // Bob should have:
            //   - 0 JoeToken
            //   - 80 extraRewardToken
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal(80)
            await advanceTimeAndBlock(5) // t-43

            await this.extraRewardToken.mint(this.rewarder.address, "1000") // t-42
            await advanceTimeAndBlock(10) // t-32

            await this.chef.connect(this.bob).deposit(0, "0") // t-31

            // Bob should have:
            //   - 0 JoeToken
            //   - 80 + 20*40 = 880 (+40) extraRewardToken
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(760, 920)
        })

        it("should reward AVAX accurately after rewarder runs out of AVAX and is topped up again", async function () {
            const bobBalBefore = await this.bob.getBalance()
            const startTime = (await latest()).add(60)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.rewarderAVAX = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address, // Use any token
                this.lp.address,
                ethers.utils.parseEther("10"),
                this.chef.address,
                true
            )
            await this.rewarderAVAX.deployed() // t-58

            await this.alice.sendTransaction({ to: this.rewarderAVAX.address, value: ethers.utils.parseEther("20") }) // t-57

            await this.lander.mint(this.chef.address, "0") // t-56 just to advance time

            await this.chef.add("100", this.lp.address, this.rewarderAVAX.address) // t-55

            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await this.chef.connect(this.bob).deposit(0, "100") // t-53
            await advanceTimeAndBlock(4) // t-49

            await this.chef.connect(this.bob).deposit(0, "0") // t-48
            // Bob should have:
            //   - 0 JoeToken
            //   - 20 Ether
            const bobBalAfter = await this.bob.getBalance()
            expect(bobBalAfter.sub(bobBalBefore)).to.gt(ethers.utils.parseEther("19"))
            expect(bobBalAfter.sub(bobBalBefore)).to.lt(ethers.utils.parseEther("20"))
            await advanceTimeAndBlock(5) // t-43

            await this.alice.sendTransaction({ to: this.rewarderAVAX.address, value: ethers.utils.parseEther("1000") }) // t-42
            await advanceTimeAndBlock(10) // t-32

            await this.chef.connect(this.bob).deposit(0, "0") // t-31

            // Bob should have:
            //   - 0 JoeToken
            //   - 20 + 20*10 = 220 (+10) extraRewardToken
            const bobBalFinal = await this.bob.getBalance()
            const b = bobBalFinal.sub(bobBalAfter)
            console.log(b.toString())
            expect(bobBalFinal.sub(bobBalAfter)).to.gt(ethers.utils.parseEther("190"))
            expect(bobBalFinal.sub(bobBalAfter)).to.lt(ethers.utils.parseEther("210"))
        })

        it("should only allow StakingPools to call onLanderReward", async function () {
            const startTime = (await latest()).add(60)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, "0") // t-56 just to advance time

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55

            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await this.chef.connect(this.bob).deposit(0, "100") // t-53
            await advanceTimeAndBlock(42) // t-11

            await expect(this.rewarder.onLanderReward(this.bob.address, "100")).to.be.revertedWith("onlyMCL: only MasterChefLander can call this function") // t-10
            await this.chef.connect(this.bob).deposit(0, "0") // t-9
            // Bob should have:
            //   - 0 JoeToken
            //   - 44*40 = 1760 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(1760, 1800)
        })

        it("should allow rewarder to be set and removed mid farming", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )

            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, "0") // t-56 just to advance time

            await this.chef.add("100", this.lp.address, ADDRESS_ZERO) // t-55

            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await this.chef.connect(this.bob).deposit(0, "100") // t-53
            await advanceTimeAndBlock(42) // t-11

            await this.chef.connect(this.bob).deposit(0, "0") // t-10
            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            // At t+10, Bob should have pending:
            //   - 10*100 = 1000 (+300) JoeToken
            //   - 0 extraRewardToken
            await advanceTimeAndBlock(20) // t+10
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.be.within(1000, 1300)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

            // Pass rewarder but don't overwrite
            await this.chef.set(0, 100, this.rewarder.address, false) // t+11

            // At t+20, Bob should have pending:
            //   - 1000 + 10*100 = 2000 (+300) JoeToken
            //   - 0 extraRewardToken
            await advanceTimeAndBlock(9) // t+20
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.be.within(2000, 2300)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(ADDRESS_ZERO)
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

            // Pass rewarder and overwrite
            await this.chef.set(0, 100, this.rewarder.address, true) // t+21

            // At t+30, Bob should have pending:
            //   - 1000 + 20*100 = 3000 (+300) JoeToken
            //   - 0 extraRewardToken - this is because rewarder hasn't registered the user yet! User needs to call deposit again
            await advanceTimeAndBlock(9) // t+30
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.be.within(3000, 3300)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.extraRewardToken.address)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("PARTNER")
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.equal(0)

            // Call deposit to start receiving extraRewardTokens
            await this.chef.connect(this.bob).deposit(0, 0) // t+31

            // At t+40, Bob should have pending:
            //   - 9*100 = 900 (+300) JoeToken
            //   - 9*40 = 360 (+40) extraRewardToken
            await advanceTimeAndBlock(9) // t+40
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.be.within(900, 1200)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.extraRewardToken.address)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("PARTNER")
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.be.within(360, 400)

            // Set reward rate to zero
            await this.rewarder.setRewardRate(0) // t+41

            // At t+50, Bob should have pending:
            //   - 900 + 10*100 = 1900 (+300) JoeToken
            //   - 360 + 1*40 = 400 (+40) extraRewardToken
            await advanceTimeAndBlock(4) // t+45
            await advanceTimeAndBlock(5) // t+50
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.be.within(1900, 2200)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenAddress).to.equal(this.extraRewardToken.address)
            expect((await this.chef.pendingTokens(0, this.bob.address)).bonusTokenSymbol).to.equal("PARTNER")
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingBonusToken).to.be.within(400, 440)

            // Claim reward
            await this.chef.connect(this.bob).deposit(0, 0) // t+51

            // Bob should have:
            //   - 3000 + 100*1 + 1900 + 100*1 = 5100 (+300) JoeToken
            //   - 400 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(5100, 5400)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(400, 440)
        })

        it("should give out JOEs only after farming time", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, "0") // t-56

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55

            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await this.chef.connect(this.bob).deposit(0, "100") // t-53
            await advanceTimeAndBlock(42) // t-11

            await this.chef.connect(this.bob).deposit(0, "0") // t-10
            // Bob should have:
            //   - 0 JoeToken
            //   - 43*40 = 1720 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(1720, 1760)
            await advanceTimeAndBlock(8) // t-2

            await this.chef.connect(this.bob).deposit(0, "0") // t-1
            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            await advanceTimeAndBlock(10) // t+9

            await this.chef.connect(this.bob).deposit(0, "0") // t+10
            // Bob should have:
            //   - 10*50 = 500 (+50) JoeToken
            //   - 1720 + 20*40 = 2520 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(1000, 1300)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(2520, 2560)

            await advanceTimeAndBlock(4) // t+14
            await this.chef.connect(this.bob).deposit(0, "0") // t+15

            // At this point:
            //   Bob should have:
            //     - 500 + 5*50 = 750 (+50) JoeToken
            //     - 2520 + 5*40 = 2720 (+40) extraRewardToken
            //   Dev should have: 15*20 = 300 (+20)
            //   Treasury should have: 15*20 = 300 (+20)
            //   Investor should have: 15*10 = 150 (+10)
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(1500, 1800)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(2720, 2760)
        })

        it("should not distribute JOEs if no one deposit", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, 0) // t-56

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55
            await this.lp.connect(this.bob).approve(this.chef.address, "1000") // t-54
            await advanceTimeAndBlock(108) // t+54


            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal("0")
            await advanceTimeAndBlock(5) // t+59

            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal("0")
            await advanceTimeAndBlock(5) // t+64
            await this.chef.connect(this.bob).deposit(0, "10") // t+65

            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.lander.balanceOf(this.dev.address)).to.equal("0")
            expect(await this.lp.balanceOf(this.bob.address)).to.equal("990")
            await advanceTimeAndBlock(10) // t+75
            // Revert if Bob withdraws more than he deposited
            await expect(this.chef.connect(this.bob).withdraw(0, "11")).to.be.revertedWith("withdraw: not good") // t+76
            await this.chef.connect(this.bob).withdraw(0, "10") // t+77

            // At this point:
            //   Bob should have:
            //     - 12*100 = 1200 (+300) JoeToken
            //     - 12*40 = 480 (+40) extraRewardToken
            //  Dev should have:
            //     - 12*20 = 240 (+20) JoeToken
            //  Treasury should have:
            //     - 12*20 = 240 (+20) JoeToken
            //  Investor should have:
            //     - 12*10 = 120 (+10) Joetoken

            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(1200, 1500)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(480, 520)
        })

        it("should distribute JOEs properly for each staker", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, 0) // t-56

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55
            await this.lp.connect(this.alice).approve(this.chef.address, "1000", {
                from: this.alice.address,
            }) // t-54
            await this.lp.connect(this.bob).approve(this.chef.address, "1000", {
                from: this.bob.address,
            }) // t-53
            await this.lp.connect(this.carol).approve(this.chef.address, "1000", {
                from: this.carol.address,
            }) // t-52

            // Alice deposits 10 LPs at t+10
            await advanceTimeAndBlock(59) // t+9
            await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
            // Bob deposits 20 LPs at t+14
            await advanceTimeAndBlock(3) // t+13
            await this.chef.connect(this.bob).deposit(0, "20") // t+14
            // Carol deposits 30 LPs at block t+18
            await advanceTimeAndBlock(3) // t+17
            await this.chef.connect(this.carol).deposit(0, "30", { from: this.carol.address }) // t+18
            // Alice deposits 10 more LPs at t+20. At this point:
            //   Alice should have:
            //      - 4*100 + 4*100*1/3 + 2*100*1/6 = 566 (+300) JoeToken
            //      - 4*40 + 4*40*1/3 + 2*40*1/6 = 226 (+40) extraRewardToken
            //   MasterChef should have: 1000 - 566 = 434 (+300)
            await advanceTimeAndBlock(1) // t+19
            await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+20,


            console.log(await this.chef.poolInfo(0));
            console.log(await this.lander.balanceOf(this.alice.address));

            // Because LP rewards are divided among participants and rounded down, we account
            // for rounding errors with an offset
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(566 - this.tokenOffset, 866 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.carol.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.chef.address)).to.be.within(434 - this.tokenOffset, 734 + this.tokenOffset)
            // Bob withdraws 5 LPs at t+30. At this point:
            //   Bob should have:
            //     - 4*100*2/3 + 2*100*2/6 + 10*100*2/7 = 619 (+300) JoeToken
            //     - 4*40*2/3 + 2*40*2/6 + 10*40*2/7 = 247 (+40) extraRewardToken

            //   MasterChef should have: 434 + 1000 - 619 = 815 (+300)
            await advanceTimeAndBlock(9) // t+29
            await this.chef.connect(this.bob).withdraw(0, "5", { from: this.bob.address }) // t+30

            // Because of rounding errors, we use token offsets
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(566 - this.tokenOffset, 866 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(619 - this.tokenOffset, 919 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(247 - this.tokenOffset, 287 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.carol.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.chef.address)).to.be.within(815 - this.tokenOffset, 1115 + this.tokenOffset)
            // Alice withdraws 20 LPs at t+40
            // Bob withdraws 15 LPs at t+50
            // Carol withdraws 30 LPs at t+60
            await advanceTimeAndBlock(9) // t+39
            await this.chef.connect(this.alice).withdraw(0, "20", { from: this.alice.address }) // t+40
            await advanceTimeAndBlock(9) // t+49
            await this.chef.connect(this.bob).withdraw(0, "15", { from: this.bob.address }) // t+50
            await advanceTimeAndBlock(9) // t+59
            await this.chef.connect(this.carol).withdraw(0, "30", { from: this.carol.address }) // t+60

            // Alice should have:
            //  - 566 + 10*100*2/7 + 10*100*20/65 = 1159 (+300) JoeToken
            //  - 226 + 10*40*2/7 + 10*40*20/65 = 463 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(1159 - this.tokenOffset, 1459 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(463 - this.tokenOffset, 503 + this.tokenOffset)
            // Bob should have:
            //  - 619 + 10*100*15/65 + 10*100*15/45 = 1183 (+300) JoeToken
            //  - 247 + 10*40*15/65 + 10*40*15/45 = 472 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(1183 - this.tokenOffset, 1483 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(472 - this.tokenOffset, 512 + this.tokenOffset)
            // Carol should have:
            //  - 2*100*3/6 + 10*100*3/7 + 10*100*30/65 + 10*100*30/45 + 10*100 = 2656 (+300) JoeToken
            //  - 2*40*1/2 + 10*40*3/7 + 10*40*30/65 + 10*40*30/45 + 10*40 = 1062 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.carol.address)).to.be.within(2656 - this.tokenOffset, 2956 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.be.within(1062 - this.tokenOffset, 1102 + this.tokenOffset)

            // // All of them should have 1000 LPs back.
            expect(await this.lp.balanceOf(this.alice.address)).to.equal("1000")
            expect(await this.lp.balanceOf(this.bob.address)).to.equal("1000")
            expect(await this.lp.balanceOf(this.carol.address)).to.equal("1000")
        })

        it("should give proper JOEs allocation to each pool", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, 0) // t-56

            await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-55
            await this.lp2.connect(this.bob).approve(this.chef.address, "1000", { from: this.bob.address }) // t-54
            // Add first LP to the pool with allocation 10
            await this.chef.add("10", this.lp.address, this.rewarder.address) // t-53
            // Alice deposits 10 LPs at t+10
            await advanceTimeAndBlock(62) // t+9
            await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
            // Add LP2 to the pool with allocation 20 at t+20
            await advanceTimeAndBlock(9) // t+19
            await this.chef.add("20", this.lp2.address, ADDRESS_ZERO) // t+20
            // Alice's pending reward should be:
            //   - 10*100 = 1000 (+300) JoeToken
            //   - 10*40 = 400 (+40)  extraRewardToken
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(1000 - this.tokenOffset, 1300 + this.tokenOffset)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(400, 440)
            // Bob deposits 10 LP2s at t+25
            await advanceTimeAndBlock(4) // t+24
            await this.chef.connect(this.bob).deposit(1, "10", { from: this.bob.address }) // t+25
            // Alice's pending reward should be:
            //   - 1000 + 5*1/3*100 = 1166 (+300) JoeToken
            //   - 400 + 5*40 = 600 (+40) extraRewardToken
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(1166 - this.tokenOffset, 1466 + this.tokenOffset)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(600, 640)

            // At this point:
            //   Alice's pending reward should be:
            //     - 1166 + 5*1/3*100 = 1332 (+300) JoeToken
            //     - 600 + 5*40 = 800 (+40) extraRewardToken
            // Bob's pending reward should be:
            //     - 5*2/3*100 = 333 (+300) JoeToken
            //     - 0 extraRewardToken
            await advanceTimeAndBlock(5) // t+30
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(1332 - this.tokenOffset, 1632 + this.tokenOffset)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(800, 840)

            expect((await this.chef.pendingTokens(1, this.bob.address)).pendingLander).to.be.within(333 - this.tokenOffset, 633 + this.tokenOffset)
            expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)

            // Alice and Bob should not have pending rewards in pools they're not staked in
            expect((await this.chef.pendingTokens(1, this.alice.address)).pendingLander).to.equal("0")
            expect((await this.chef.pendingTokens(0, this.bob.address)).pendingLander).to.equal("0")

            // Make sure they have receive the same amount as what was pending
            await this.chef.connect(this.alice).withdraw(0, "10", { from: this.alice.address }) // t+31
            // Alice should have:
            //   - 1332 + 1*1/3*100 = 1365 (+300) JoeToken
            //   - 800 + 1*40 = 840 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(1365 - this.tokenOffset, 1665 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(840, 880)

            await this.chef.connect(this.bob).withdraw(1, "5", { from: this.bob.address }) // t+32
            // Bob should have:
            //   - 333 + 2*2/3*100 = 466 (+300) JoeToken
            //   - 0 extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(466 - this.tokenOffset, 766 + this.tokenOffset)
            expect(await this.rewarder.pendingTokens(this.bob.address)).to.equal(0)
        })

        it("should give proper JOEs after updating emission rate", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address,"0") // t-56

            await this.lp.connect(this.alice).approve(this.chef.address, "1000", { from: this.alice.address }) // t-55
            await this.chef.add("10", this.lp.address, this.rewarder.address) // t-54
            // Alice deposits 10 LPs at t+10
            await advanceTimeAndBlock(63) // t+9
            await this.chef.connect(this.alice).deposit(0, "10", { from: this.alice.address }) // t+10
            // At t+110, Alice should have:
            //   - 100*100 = 10000 (+300) JoeToken
            //   - 100*40 = 4000 (+40) extraRewardToken
            await advanceTimeAndBlock(100) // t+110
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(10000, 10300)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(4000, 4040)
            // Lower JOE emission rate to 40 JOE per sec
            await this.chef.updateEmissionRate(40) // t+111
            // At t+115, Alice should have:
            //   - 10000 + 1*100 + 4*40 = 10260 (+300) JoeToken
            //   - 4000 + 5*40 = 4200 (+40) extraRewardToken
            await advanceTimeAndBlock(4) // t+115
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(10260, 10560)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(4200, 4240)
            // Increase extraRewardToken emission rate to 90 extraRewardToken per block
            await this.rewarder.setRewardRate(90) // t+116
            // At b=35, Alice should have:
            //   - 10260 + 21*40 = 11100 (+300) JoeToken
            //   - 4200 + 1*40 + 20*90 = 6040 (+90) extraRewardToken
            await advanceTimeAndBlock(20) // t+136
            expect((await this.chef.pendingTokens(0, this.alice.address)).pendingLander).to.be.within(11100, 11400)
            expect(await this.rewarder.pendingTokens(this.alice.address)).to.be.within(6040, 6130)
        })

        it("should distribute JOEs properly for each staker interacted by others", async function () {
            const startTime = (await latest()).add(62)
            this.chef = await this.MCV2.deploy(
                this.lander.address,
                this.landerPerSec,
                startTime,
                this.landerSource.address,
                this.mockZapper.address
            )
            await this.chef.deployed() // t-59

            this.lander.mint(this.landerSource.address, "10000000000000000000");
            this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

            this.rewarder = await this.SimpleRewarderPerSec.deploy(
                this.extraRewardToken.address,
                this.lp.address,
                this.extraRewardPerSec,
                this.chef.address,
                false
            )
            await this.rewarder.deployed() // t-58

            await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

            await this.lander.mint(this.chef.address, 0) // t-56

            await this.chef.add("100", this.lp.address, this.rewarder.address) // t-55
            await this.lp.connect(this.mockZapper).approve(this.chef.address, "1000") // t-54
            await this.lp.connect(this.mockZapper).approve(this.chef.address, "1000") // t-53
            await this.lp.connect(this.mockZapper).approve(this.chef.address, "1000")// t-52

            // deposit 10 LPs for Alice  at t+10
            await advanceTimeAndBlock(59) // t+9
            await this.chef.connect(this.mockZapper).depositFor(0, "10", this.alice.address) // t+10
            // deposits 20 LPs for Bob at t+14
            await advanceTimeAndBlock(3) // t+13
            await this.chef.connect(this.mockZapper).depositFor(0, "20", this.bob.address) // t+14
            // deposits 30 LPs for Carol at block t+18
            await advanceTimeAndBlock(3) // t+17
            await this.chef.connect(this.mockZapper).depositFor(0, "30", this.carol.address) // t+18
            // deposits 10 more LPs for Alice at t+20. At this point:
            //   Alice should have:
            //      - 4*100 + 4*100*1/3 + 2*100*1/6 = 566 (+300) JoeToken
            //      - 4*40 + 4*40*1/3 + 2*40*1/6 = 226 (+40) extraRewardToken
            //   MasterChef should have: 1000 - 566 = 434 (+300)
            await advanceTimeAndBlock(1) // t+19
            await this.chef.connect(this.mockZapper).depositFor(0, "10", this.alice.address) // t+20,

            // Because LP rewards are divided among participants and rounded down, we account
            // for rounding errors with an offset
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(566 - this.tokenOffset, 866 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.bob.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.carol.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.chef.address)).to.be.within(434 - this.tokenOffset, 734 + this.tokenOffset)
            // withdraws 5 LPs for Bob at t+30. At this point:
            //   Bob should have:
            //     - 4*100*2/3 + 2*100*2/6 + 10*100*2/7 = 619 (+300) JoeToken
            //     - 4*40*2/3 + 2*40*2/6 + 10*40*2/7 = 247 (+40) extraRewardToken

            //   MasterChef should have: 434 + 1000 - 619 = 815 (+300)
            await advanceTimeAndBlock(9) // t+29
            await this.chef.connect(this.mockZapper).withdrawFor(0, "5", this.bob.address) // t+30

            // Because of rounding errors, we use token offsets
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(566 - this.tokenOffset, 866 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(226 - this.tokenOffset, 266 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(619 - this.tokenOffset, 919 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(247 - this.tokenOffset, 287 + this.tokenOffset)

            expect(await this.lander.balanceOf(this.carol.address)).to.equal("0")
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.equal("0")

            expect(await this.lander.balanceOf(this.chef.address)).to.be.within(815 - this.tokenOffset, 1115 + this.tokenOffset)
            // Alice withdraws 20 LPs at t+40
            // Bob withdraws 15 LPs at t+50
            // Carol withdraws 30 LPs at t+60
            await advanceTimeAndBlock(9) // t+39
            await this.chef.connect(this.mockZapper).withdrawFor(0, "20", this.alice.address) // t+40
            await advanceTimeAndBlock(9) // t+49
            await this.chef.connect(this.mockZapper).withdrawFor(0, "15", this.bob.address ) // t+50
            await advanceTimeAndBlock(9) // t+59
            await this.chef.connect(this.mockZapper).withdrawFor(0, "30",  this.carol.address ) // t+60

            // Alice should have:
            //  - 566 + 10*100*2/7 + 10*100*20/65 = 1159 (+300) JoeToken
            //  - 226 + 10*40*2/7 + 10*40*20/65 = 463 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.alice.address)).to.be.within(1159 - this.tokenOffset, 1459 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.alice.address)).to.be.within(463 - this.tokenOffset, 503 + this.tokenOffset)
            // Bob should have:
            //  - 619 + 10*100*15/65 + 10*100*15/45 = 1183 (+300) JoeToken
            //  - 247 + 10*40*15/65 + 10*40*15/45 = 472 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.bob.address)).to.be.within(1183 - this.tokenOffset, 1483 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.bob.address)).to.be.within(472 - this.tokenOffset, 512 + this.tokenOffset)
            // Carol should have:
            //  - 2*100*3/6 + 10*100*3/7 + 10*100*30/65 + 10*100*30/45 + 10*100 = 2656 (+300) JoeToken
            //  - 2*40*1/2 + 10*40*3/7 + 10*40*30/65 + 10*40*30/45 + 10*40 = 1062 (+40) extraRewardToken
            expect(await this.lander.balanceOf(this.carol.address)).to.be.within(2656 - this.tokenOffset, 2956 + this.tokenOffset)
            expect(await this.extraRewardToken.balanceOf(this.carol.address)).to.be.within(1062 - this.tokenOffset, 1102 + this.tokenOffset)

            // // All of them should have 1000 LPs back.
            expect(await this.lp.balanceOf(this.alice.address)).to.equal("1020")
            expect(await this.lp.balanceOf(this.bob.address)).to.equal("1020")
            expect(await this.lp.balanceOf(this.carol.address)).to.equal("1030")
        })
    })

    after(async function () {
        await network.provider.request({
            method: "hardhat_reset",
            params: [],
        })
    })
})