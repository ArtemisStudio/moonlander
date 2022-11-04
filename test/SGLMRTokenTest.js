const { expect } = require("chai");
const { ethers } = require("hardhat");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("SGLMR", function () {
  let owner;
  let player1;
  let player2;

  let mGlmr;
  let sGlmr;

  before(async () => {
    MockERC20Factory = await ethers.getContractFactory("MockERC20");
    SGLMRFactory = await ethers.getContractFactory("SGLMR");
   
  });

  beforeEach(async () => {
    [owner, player1, player2] = await ethers.getSigners();

    mGlmr = await MockERC20Factory.connect(owner).deploy("moon GLMR","mGLMR");

    expect(await mGlmr.name()).to.be.equal("moon GLMR");
    expect(await mGlmr.symbol()).to.be.equal("mGLMR");

  });


  describe("Constructor", function() {
    it("can deploy with correct asset address", async function () {
      sGlmr = await SGLMRFactory.connect(owner).deploy(mGlmr.address, "staked mGLMR", "sGLMR");
      expect(await sGlmr.name()).to.be.equal("staked mGLMR");
      expect(await sGlmr.symbol()).to.be.equal("sGLMR");
      expect(await sGlmr.asset()).to.be.equal(mGlmr.address);
    });
  })

  describe("Single User", function(){
    beforeEach(async () => {
      sGlmr = await SGLMRFactory.connect(owner).deploy(mGlmr.address, "staked mGLMR", "sGLMR");

      await mGlmr.connect(owner).mint(player1.address,"100000000000000000000000"); // 100K mGLMR

      await mGlmr.connect(player1).approve(sGlmr.address,"10000000000000000000000000"); // 1m allowance
    });

    it("is correct on initial deposit withdraw", async function () {

      await sGlmr.connect(player1).deposit("10000000000000000000000",player1.address);

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("90000000000000000000000");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("10000000000000000000000");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("10000000000000000000000");
      expect(await sGlmr.totalAssets()).to.be.equal("10000000000000000000000");
      expect(await sGlmr.totalSupply()).to.be.equal("10000000000000000000000");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("10000000000000000000000");

      await sGlmr.connect(player1).withdraw("4000000000000000000000", player1.address, player1.address); // 4,000

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("94000000000000000000000"); // 94,000
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("6000000000000000000000"); // 6,000

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("6000000000000000000000"); // 6,000
      expect(await sGlmr.totalAssets()).to.be.equal("6000000000000000000000"); // 6,000
      expect(await sGlmr.totalSupply()).to.be.equal("6000000000000000000000"); // 6,000

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("6000000000000000000000"); // 6,000

    });

    it("is correct on initial mint redeem", async function () {
      await sGlmr.connect(player1).mint("10000000000000000000000",player1.address);

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("90000000000000000000000");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("10000000000000000000000");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("10000000000000000000000");
      expect(await sGlmr.totalAssets()).to.be.equal("10000000000000000000000");
      expect(await sGlmr.totalSupply()).to.be.equal("10000000000000000000000");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("10000000000000000000000");

      await sGlmr.connect(player1).redeem("4000000000000000000000", player1.address, player1.address); // 4,000

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("94000000000000000000000"); // 94,000
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("6000000000000000000000"); // 6,000

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("6000000000000000000000"); // 6,000
      expect(await sGlmr.totalAssets()).to.be.equal("6000000000000000000000"); // 6,000
      expect(await sGlmr.totalSupply()).to.be.equal("6000000000000000000000"); // 6,000
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("6000000000000000000000"); // 6,000
    });
  });

  describe("Multiple Players", function(){
    beforeEach(async () => {
      sGlmr = await SGLMRFactory.connect(owner).deploy(mGlmr.address, "staked mGLMR", "sGLMR");

      await mGlmr.connect(owner).mint(player1.address,"4000"); 
      await mGlmr.connect(owner).mint(player2.address,"7001"); 

      await mGlmr.connect(player1).approve(sGlmr.address,"4000"); 
      await mGlmr.connect(player2).approve(sGlmr.address,"7001"); 
    });

    it("is correct for multiple players",async function() {
      console.log("1. Player1 mints 2000 shares (costs 2000 tokens)");
      await sGlmr.connect(player1).deposit("2000",player1.address);

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("2000");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("2000");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("2000");
      expect(await sGlmr.totalAssets()).to.be.equal("2000");
      expect(await sGlmr.totalSupply()).to.be.equal("2000");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("2000");
      expect(await sGlmr.convertToShares("2000")).to.be.equal(await sGlmr.balanceOf(player1.address));

      console.log("2. player2 deposits 4000 tokens (mints 4000 shares)");
      await sGlmr.connect(player2).deposit("4000",player2.address);
      let player2Underlying = await sGlmr.previewWithdraw("4000");

      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("3001");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("4000");

      expect(await sGlmr.totalAssets()).to.be.equal("6000");
      expect(await sGlmr.totalSupply()).to.be.equal("6000");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("4000");
      expect(await sGlmr.convertToShares("4000")).to.be.equal(player2Underlying);

      console.log("3. Vault mutates by +3000 tokens (simulated yield returned from strategy)");
      await mGlmr.mint(sGlmr.address, "3000");

      expect(await sGlmr.totalSupply()).to.be.equal("6000");
      expect(await sGlmr.totalAssets()).to.be.equal("9000");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("2000");
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("3000");

      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("4000");
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("6000");

      console.log("4. player1 deposits 2000 tokens (mints 1333 shares)");
      await sGlmr.connect(player1).deposit("2000",player1.address);

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("3333");

      expect(await sGlmr.totalAssets()).to.be.equal("11000");
      expect(await sGlmr.totalSupply()).to.be.equal("7333");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("4999");
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("6000");

      console.log("5. player2 mints 2000 shares (costs 3001 assets)  2000*11000/7333 ~ 3001");
      await sGlmr.connect(player2).mint("2000",player2.address);

      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("6000");

      expect(await sGlmr.totalAssets()).to.be.equal("14001");
      expect(await sGlmr.totalSupply()).to.be.equal("9333");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("5000"); // 3333*14001/9333
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("9000"); // 

      console.log("6. Vault mutates by +3000 tokens");
      await mGlmr.mint(sGlmr.address, "3000"); // totalAsset = 17000

      expect(await sGlmr.totalAssets()).to.be.equal("17001");
      expect(await sGlmr.totalSupply()).to.be.equal("9333");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("6071"); // 3333*17001/9333
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("10929"); // 6000*17001/9333

      console.log("7. Player1 redeem 1333 shares (2428 assets)");
      await sGlmr.connect(player1).redeem("1333",player1.address,player1.address);
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("2428");

      expect(await sGlmr.totalSupply()).to.be.equal("8000");
      expect(await sGlmr.totalAssets()).to.be.equal("14573");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("2000");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("6000");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("3643"); // 2000*14573/8000
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("10929"); // 6000*14573/8000


      console.log("8. player2 withdraws 2929 assets (1608 shares) // 2929*8000/14572");
      await sGlmr.connect(player2).withdraw("2929",player2.address,player2.address);
      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("2929");

      expect(await sGlmr.totalSupply()).to.be.equal("6392");
      expect(await sGlmr.totalAssets()).to.be.equal("11644");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("2000");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("4392");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("3643"); // 2000*11644/6392
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("8000"); // 4392*11644/6392

      console.log("9. player1 withdraws 3643 assets (2000 shares) // 3642*6392/11643");
      
      await sGlmr.connect(player1).withdraw("3643",player1.address,player1.address);
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("6071");

      expect(await sGlmr.totalSupply()).to.be.equal("4392");
      expect(await sGlmr.totalAssets()).to.be.equal("8001");

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("4392");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("0"); // 0*8001/4392
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("8001"); // 4392*8001/4392

      console.log("10. player2 redeem 4392 shares (8000 tokens)");
      await sGlmr.connect(player2).redeem("4392",player2.address,player2.address); // 4392*8000/4392

      expect(await sGlmr.totalSupply()).to.be.equal("0");
      expect(await sGlmr.totalAssets()).to.be.equal("0");

      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("0"); // 0*8001/4392
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player2.address))).to.be.equal("0"); // 
      expect(await mGlmr.balanceOf(sGlmr.address)).to.be.equal("0");
    });
    
  })

  describe("Should Fail Cases", function(){
    beforeEach(async () => {
      sGlmr = await SGLMRFactory.connect(owner).deploy(mGlmr.address, "staked mGLMR", "sGLMR");
    });

    it("FailDepositWithNotEnoughApproval",async function() {
      await mGlmr.mint(player1.address,"20000000");
      await mGlmr.connect(player1).approve(sGlmr.address,"10000000");

      expect(await mGlmr.allowance(player1.address,sGlmr.address)).to.be.equal("10000000");

      await expect(sGlmr.connect(player1).deposit("20000000",player1.address)).to.be.reverted;

    });

    it("testFailWithdrawWithNotEnoughUnderlyingAmount",async function() {
      await mGlmr.mint(player1.address,"10000000");
      await mGlmr.connect(player1).approve(sGlmr.address,"20000000");

      await expect(sGlmr.connect(player1).deposit("20000000",player1.address)).to.be.reverted;

    })

    it("testFailRedeemWithNotEnoughShareAmount",async function() {
      await mGlmr.mint(player1.address,"10000000");
      await mGlmr.connect(player1).approve(sGlmr.address,"10000000");

      await sGlmr.connect(player1).deposit("10000000",player1.address)

      await expect(sGlmr.connect(player1).redeem("10000001",player1.address)).to.be.reverted;

    })

    it("testFailWithdrawWithNoUnderlyingAmount",async function() {
      await expect(sGlmr.connect(player1).withdraw("1",player1.address,player1.address)).to.be.reverted;
    })

    it("testFailRedeemWithNoShareAmount",async function() {
      await expect(sGlmr.connect(player1).redeem("1",player1.address,player1.address)).to.be.reverted;
    })

    it("testFailDepositWithNoApproval",async function() {
      await expect(sGlmr.connect(player1).deposit("1",player1.address)).to.be.reverted;
    })

    it("testFailMintWithNoApproval",async function() {
      await expect(sGlmr.connect(player1).mint("1",player1.address)).to.be.reverted;
    })

    it("testMintZero",async function() {
      await sGlmr.connect(player1).mint("0",player1.address);

      expect(await sGlmr.totalSupply()).to.be.equal("0");
      expect(await sGlmr.totalAssets()).to.be.equal("0");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("0"); 
    })

    it("testWithdrawZero",async function() {
      await sGlmr.connect(player1).withdraw("0",player1.address,player1.address);

      expect(await sGlmr.totalSupply()).to.be.equal("0");
      expect(await sGlmr.totalAssets()).to.be.equal("0");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.convertToAssets(sGlmr.balanceOf(player1.address))).to.be.equal("0"); 
    })
  
  })

  describe("Interactions For SomeoneElse", function(){
    beforeEach(async () => {
      sGlmr = await SGLMRFactory.connect(owner).deploy(mGlmr.address, "staked mGLMR", "sGLMR");

      await mGlmr.connect(owner).mint(player1.address,"1000"); 
      await mGlmr.connect(owner).mint(player2.address,"1000"); 

      await mGlmr.connect(player1).approve(sGlmr.address,"100000000000");
      await mGlmr.connect(player2).approve(sGlmr.address,"100000000000");

    });

    it("can not withdraw for others without allowance",async function() {
      await sGlmr.connect(player1).deposit("1000",player1.address);
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("1000");

      await expect(sGlmr.connect(player2).withdraw("1000",player1.address,player1.address)).to.be.reverted;

      await sGlmr.connect(player1).approve(player2.address,"100000000000");

      await sGlmr.connect(player2).withdraw("1000",player1.address,player1.address);

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("1000");

    })

    it("can not redeem for others without allowance",async function() {
      await sGlmr.connect(player1).deposit("1000",player1.address);
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("1000");

      await expect(sGlmr.connect(player2).redeem("1000",player1.address,player1.address)).to.be.reverted;

      await sGlmr.connect(player1).approve(player2.address,"100000000000");

      await sGlmr.connect(player2).redeem("1000",player1.address,player1.address);

      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");

      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("1000");

    })

    it("can interact for others",async function() {
      await sGlmr.connect(player1).deposit("1000",player2.address);

      expect(await sGlmr.totalSupply()).to.be.equal("1000");
      expect(await sGlmr.totalAssets()).to.be.equal("1000");
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("1000");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("1000");


      await sGlmr.connect(player2).mint("1000",player1.address);

      expect(await sGlmr.totalSupply()).to.be.equal("2000");
      expect(await sGlmr.totalAssets()).to.be.equal("2000");
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("1000");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("1000");

      // player 1 redeem for player2
      await sGlmr.connect(player1).redeem("1000",player2.address,player1.address);

      expect(await sGlmr.totalSupply()).to.be.equal("1000");
      expect(await sGlmr.totalAssets()).to.be.equal("1000");
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("1000");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("1000");

      // player 2 withdraw for player1
      await sGlmr.connect(player2).withdraw("1000",player1.address,player2.address);

      expect(await sGlmr.totalSupply()).to.be.equal("0");
      expect(await sGlmr.totalAssets()).to.be.equal("0");
      expect(await mGlmr.balanceOf(player1.address)).to.be.equal("1000");
      expect(await mGlmr.balanceOf(player2.address)).to.be.equal("1000");
      expect(await sGlmr.balanceOf(player1.address)).to.be.equal("0");
      expect(await sGlmr.balanceOf(player2.address)).to.be.equal("0");
    })
  })
});