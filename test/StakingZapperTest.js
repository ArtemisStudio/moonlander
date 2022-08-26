const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { ADDRESS_ZERO } = require("./utilities");
const { advanceTimeAndBlock, advanceBlockTo, latest, duration, increase } = require("./utilities/time");

describe("StakingZapper", function () {
    before(async function () {
        this.signers = await ethers.getSigners()
        this.alice = this.signers[0]
        this.bob = this.signers[1]
        this.carol = this.signers[2]
        this.landerSource = this.signers[3]

        this.MCV2 = await ethers.getContractFactory("StakingPools")
        this.SimpleRewarderPerSec = await ethers.getContractFactory("SimpleRewarderPerSec")
        this.ERC20Mock = await ethers.getContractFactory("MockERC20", this.minter)
        this.ZapperContract = await ethers.getContractFactory("StakingZapper");

        this.SToken = await ethers.getContractFactory("SGLMR");

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

        this.mglmr = await this.ERC20Mock.deploy("Moonlander GLMR", "mGLMR") // b=3
        await this.mglmr.deployed()
        
    })

    it("should check input varible", async function () {
        await expect(
            this.ZapperContract.deploy(ADDRESS_ZERO)
        ).to.be.revertedWith("constructor: sToken must be a valid contract")

        await expect(
            this.ZapperContract.deploy(this.alice.address)
        ).to.be.revertedWith("constructor: sToken must be a valid contract")


        // deploy sGLMR
        this.sglmr = await this.SToken.deploy(this.mglmr.address,"Staked Moon GLMR","sGLMR");
        await this.sglmr.deployed()

        this.zapper = await this.ZapperContract.deploy(this.sglmr.address);
        await this.zapper.deployed()

        await expect(
            this.zapper.initiate(ADDRESS_ZERO,0)
        ).to.be.revertedWith("StakingZapper: stakingPools must be a valid contract")

        await expect(
            this.zapper.initiate(this.alice.address,0)
        ).to.be.revertedWith("StakingZapper: stakingPools must be a valid contract")

    })

    it("should set correct state variables", async function () {
        // deploy sGLMR
        this.sglmr = await this.SToken.deploy(this.mglmr.address,"Staked Moon GLMR","sGLMR");
        await this.sglmr.deployed()
        // deploy Zapper
        this.zapper = await this.ZapperContract.deploy(this.sglmr.address);
        await this.zapper.deployed()

        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.MCV2.deploy(
            this.lander.address,
            this.landerPerSec,
            startTime,
            this.landerSource.address,
            this.zapper.address
        )
        await this.chef.deployed()

        this.lander.mint(this.landerSource.address, "10000000000000000000");
        this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

        this.rewarder = await this.SimpleRewarderPerSec.deploy(
            this.extraRewardToken.address,
            this.sglmr.address,
            this.extraRewardPerSec,
            this.chef.address,
            false
        )

        await this.rewarder.deployed() // t-58

        await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

        await this.chef.add("100", this.sglmr.address, this.rewarder.address) // t-56

        await this.zapper.initiate(this.chef.address,0) // t-55


        const lander = await this.chef.lander();
        const landerSource = await this.chef.landerRewardSource();
        const zapper = await this.chef.zapperAddress();

        

        expect(lander).to.equal(this.lander.address)
        expect(landerSource).to.equal(this.landerSource.address)
        expect(zapper).to.equal(this.zapper.address)

        expect(await this.zapper.stakingPools()).to.equal(this.chef.address)
        expect(await this.zapper.sToken()).to.equal(this.sglmr.address)
        expect(await this.zapper.pid()).to.equal(0)

    })

    it("should directDeposit", async function () {
        // deploy sGLMR
        this.sglmr = await this.SToken.deploy(this.mglmr.address,"Staked Moon GLMR","sGLMR");
        await this.sglmr.deployed()
        // deploy Zapper
        this.zapper = await this.ZapperContract.deploy(this.sglmr.address);
        await this.zapper.deployed()

        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.MCV2.deploy(
            this.lander.address,
            this.landerPerSec,
            startTime,
            this.landerSource.address,
            this.zapper.address
        )
        await this.chef.deployed()

        this.lander.mint(this.landerSource.address, "10000000000000000000");
        this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

        this.rewarder = await this.SimpleRewarderPerSec.deploy(
            this.extraRewardToken.address,
            this.sglmr.address,
            this.extraRewardPerSec,
            this.chef.address,
            false
        )

        await this.rewarder.deployed() // t-58

        await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

        await this.chef.add("100", this.sglmr.address, this.rewarder.address) // t-56

        await this.zapper.initiate(this.chef.address,0) // t-55

        await this.mglmr.mint(this.bob.address,1000);

        await this.mglmr.connect(this.bob).approve(this.zapper.address,1000);

        await this.zapper.connect(this.bob).directDeposit(200);

        expect(await this.mglmr.balanceOf(this.bob.address)).to.be.equal(800);
        expect(await this.sglmr.balanceOf(this.bob.address)).to.be.equal(200);

    })

    it("should directStake", async function () {
        // deploy sGLMR
        this.sglmr = await this.SToken.deploy(this.mglmr.address,"Staked Moon GLMR","sGLMR");
        await this.sglmr.deployed()
        // deploy Zapper
        this.zapper = await this.ZapperContract.deploy(this.sglmr.address);
        await this.zapper.deployed()

        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.MCV2.deploy(
            this.lander.address,
            this.landerPerSec,
            startTime,
            this.landerSource.address,
            this.zapper.address
        )
        await this.chef.deployed()

        await this.lander.mint(this.landerSource.address, "10000000000000000000");
        await this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

        this.rewarder = await this.SimpleRewarderPerSec.deploy(
            this.extraRewardToken.address,
            this.sglmr.address,
            this.extraRewardPerSec,
            this.chef.address,
            false
        )

        await this.rewarder.deployed() // t-58

        await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

        await this.chef.add("100", this.sglmr.address, this.rewarder.address) // t-56

        await this.zapper.initiate(this.chef.address,0) // t-55

        await this.mglmr.mint(this.bob.address,1000);

        await this.mglmr.connect(this.bob).approve(this.sglmr.address,1000);

        await this.sglmr.connect(this.bob).deposit(200,this.bob.address);

        expect(await this.mglmr.balanceOf(this.bob.address)).to.be.equal(800);
        expect(await this.sglmr.balanceOf(this.bob.address)).to.be.equal(200);

        await this.sglmr.connect(this.bob).approve(this.zapper.address,1000);

        await this.zapper.connect(this.bob).directStake(200);

        expect(await this.mglmr.balanceOf(this.bob.address)).to.be.equal(800);
        expect(await this.sglmr.balanceOf(this.bob.address)).to.be.equal(0);
        

        let {amount} = await this.chef.userInfo(0,this.bob.address);
        
        expect(amount).to.be.equal(200);
    })

    it("should depositAndStake", async function () {
        // deploy sGLMR
        this.sglmr = await this.SToken.deploy(this.mglmr.address,"Staked Moon GLMR","sGLMR");
        await this.sglmr.deployed()
        // deploy Zapper
        this.zapper = await this.ZapperContract.deploy(this.sglmr.address);
        await this.zapper.deployed()

        // We make start time 60 seconds past the last block
        const startTime = (await latest()).add(60)
        this.chef = await this.MCV2.deploy(
            this.lander.address,
            this.landerPerSec,
            startTime,
            this.landerSource.address,
            this.zapper.address
        )
        await this.chef.deployed()

        await this.lander.mint(this.landerSource.address, "10000000000000000000");
        await this.lander.connect(this.landerSource).approve(this.chef.address, "100000000000000000000");

        this.rewarder = await this.SimpleRewarderPerSec.deploy(
            this.extraRewardToken.address,
            this.sglmr.address,
            this.extraRewardPerSec,
            this.chef.address,
            false
        )

        await this.rewarder.deployed() // t-58

        await this.extraRewardToken.mint(this.rewarder.address, "1000000000000000000000000") // t-57

        await this.chef.add("100", this.sglmr.address, this.rewarder.address) // t-56

        await this.zapper.initiate(this.chef.address,0) // t-55


        await this.mglmr.mint(this.bob.address,1000);

        await this.mglmr.connect(this.bob).approve(this.zapper.address,1000);

        await this.zapper.connect(this.bob).depositAndStake(400);

        expect(await this.mglmr.balanceOf(this.bob.address)).to.be.equal(600);
        expect(await this.sglmr.balanceOf(this.bob.address)).to.be.equal(0);
        

        let {amount} = await this.chef.userInfo(0,this.bob.address);
        
        expect(amount).to.be.equal(400);

    })

    
})