import "@nomiclabs/hardhat-ethers";

import { AcademyToken, AcademyToken__factory } from "../typechain-types";
import { BaseProvider, JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber, Contract } from "ethers";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

// AccessControl roles in bytes32 string
// DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE

const ADMIN_ROLE = ethers.utils.id("ADMIN_ROLE");
const MINTER_ROLE = ethers.utils.id("MINTER_ROLE");
const BURNER_ROLE = ethers.utils.id("BURNER_ROLE");
const zeroAddress = "0x0000000000000000000000000000000000000000";

const multiplier = ethers.utils.parseUnits("1", 18);
const round = 0;
const tokenInitialPrice = ethers.utils.parseEther("0.00001"); // 0,00001 eth
const threeDaysInSeconds = 3 * 24 * 3600;

const name = "Academy Token";
const symbol = "ACDM";
const initialSupply = "1000";
const decimals = 18;
const bigNumberInitialSupply = ethers.utils.parseUnits(initialSupply, decimals);

const requiredMessage = {
  tokenOwner: "DAO: You are not a token owner",
  nonExistedFunction: "DAO: The called function is not in the contract",
  proposalDoesNotExist: "DAO: Proposal doesn't exist",
};

let Token: AcademyToken__factory;
let token: AcademyToken;
let tokenAddress: string;
const amount = ethers.utils.parseUnits("10", decimals);
const bigAmount = ethers.utils.parseUnits("20", decimals);

let TokenMarketplace;
let tokenMarketplace: Contract;
let tokenMarketplaceAddress: string;
const firstRoundTokensAmount = 100000;
const secondRoundTokensAmount = Math.round(4 / 0.0000143);

let provider: BaseProvider;
let owner: SignerWithAddress;
let ownerAddress: string;
let alice: SignerWithAddress;
let aliceAddress: string;
let bob: SignerWithAddress;
let bobAddress: string;
let smith: SignerWithAddress;
let smithAddress: string;
let ownerBalance: string;
let aliceBalance: string;
let bobBalance: string;

const gasOptions = {
  gasPrice: ethers.utils.parseUnits("100", "gwei"),
  gasLimit: 1000000,
};

function convertEthToTokensString(
  _amount: BigNumber,
  _price: BigNumber
): string {
  return _amount.div(_price).toString();
}

function convertTokensToEthBigNumber(
  _amount: BigNumber,
  _price: BigNumber
): BigNumber {
  return _amount.mul(_price);
}

function convertEthToTokensBigNumber(
  _amount: BigNumber,
  _price: BigNumber
): BigNumber {
  return _amount.div(_price);
}

describe("TokenMarketplace", () => {
  beforeEach(async function () {
    const initialAmountMintToUser = ethers.utils.parseUnits("1", decimals);
    provider = ethers.getDefaultProvider();

    [owner, alice, bob, smith] = await ethers.getSigners();

    Token = await ethers.getContractFactory("AcademyToken");
    token = await Token.deploy(name, symbol);

    // token.mint(owner.address, initialAmountMintToUser);
    // token.mint(bob.address, initialAmountMintToUser);
    // token.mint(alice.address, initialAmountMintToUser);

    TokenMarketplace = await ethers.getContractFactory("TokenMarketplace");
    tokenMarketplace = await TokenMarketplace.deploy(token.address);

    token.grantRole(MINTER_ROLE, tokenMarketplace.address);
    token.grantRole(BURNER_ROLE, tokenMarketplace.address);
    token.grantRole(ADMIN_ROLE, tokenMarketplace.address);

    ownerBalance = ethers.utils.formatEther(
      await token.balanceOf(owner.address)
    );

    aliceBalance = ethers.utils.formatEther(
      await token.balanceOf(alice.address)
    );

    bobBalance = ethers.utils.formatEther(await token.balanceOf(bob.address));

    tokenAddress = token.address;
    aliceAddress = alice.address;
    bobAddress = bob.address;
    smithAddress = smith.address;
    tokenMarketplaceAddress = tokenMarketplace.address;

    console.log("tokenAddress:", token.address);
    console.log("aliceAddress:", alice.address);
    console.log("bobAddress:", bob.address);
    console.log("smithAddress:", smith.address);
    console.log("tokenMarketplaceAddress:", tokenMarketplace.address);
  });

  /* -------------------------------------------------------------------------- */
  /*                                registration                                */
  /* -------------------------------------------------------------------------- */
  describe("registration", async () => {
    it("should revert if zero address", async () => {
      await expect(
        tokenMarketplace.registration(zeroAddress)
      ).to.be.revertedWith("Marketplace: Referral can't be a zero address");
    });

    it("should revert if referral is the user", async () => {
      await expect(
        tokenMarketplace.connect(bob).registration(bob.address)
      ).to.be.revertedWith(
        "Marketplace: You can't choose yourself as a referral"
      );
    });

    it("should revert if more then 2 referrals", async () => {
      await tokenMarketplace.connect(bob).registration(smith.address);
      await tokenMarketplace.connect(alice).registration(smith.address);

      await expect(
        tokenMarketplace.registration(smith.address)
      ).to.be.revertedWith("Marketplace: User can only have two referrals");
    });

    it("should be ok to add 2 referrals", async () => {
      await tokenMarketplace.connect(bob).registration(smith.address);
      await tokenMarketplace.connect(alice).registration(smith.address);

      const referral1 = await tokenMarketplace.referrals(smith.address, 0);
      const referral2 = await tokenMarketplace.referrals(smith.address, 1);

      expect(referral1).to.be.equal(bob.address);
      expect(referral2).to.be.equal(alice.address);
    });

    it("should be registered after registration and has referral as address", async () => {
      await tokenMarketplace.connect(bob).registration(smith.address);

      const registrationAddress = await tokenMarketplace.registrations(
        bob.address
      );

      expect(smith.address).to.be.equal(registrationAddress);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               startSaleRound                               */
  /* -------------------------------------------------------------------------- */
  describe("startSaleRound", async () => {
    it("should revert if is not an admin", async () => {
      await expect(
        tokenMarketplace.connect(bob).startSaleRound()
      ).to.be.revertedWith("Marketplace: You are not an admin");
    });

    it(`should mint ${firstRoundTokensAmount} tokens for the first round`, async () => {
      await tokenMarketplace.startSaleRound();
      const tokenMarketplaceACDMTokensBalance = await token.balanceOf(
        tokenMarketplaceAddress
      );

      expect(tokenMarketplaceACDMTokensBalance).to.be.equal(
        BigNumber.from(firstRoundTokensAmount)
      );
    });

    it(`should mint ${secondRoundTokensAmount} tokens for the second round`, async () => {
      await tokenMarketplace.startSaleRound();

      const amount = ethers.utils.parseEther("0.5");
      const price = ethers.utils.parseEther("0.00001");

      await token
        .connect(bob)
        .approve(
          tokenMarketplace.address,
          convertEthToTokensBigNumber(amount, price)
        );

      await tokenMarketplace.connect(bob).buyOnSaleRound({
        value: amount,
      });

      await tokenMarketplace.endSaleRound();

      const bobTokensBalance = await token.balanceOf(bobAddress);

      await tokenMarketplace
        .connect(bob)
        .createBid(bobTokensBalance, ethers.utils.parseEther("0.00008"));

      await tokenMarketplace.connect(alice).trade(0, bobTokensBalance, {
        value: ethers.utils.parseEther("0.00008").mul(bobTokensBalance),
      });

      const block = await provider.getBlock(1);
      const blockTimeStamp = block.timestamp;

      ethers.provider.send("evm_setNextBlockTimestamp", [
        blockTimeStamp + threeDaysInSeconds,
      ]);
      ethers.provider.send("evm_mine", []);

      await tokenMarketplace.endTradeRound();
      await tokenMarketplace.startSaleRound();

      const contractBalance = await token.balanceOf(tokenMarketplaceAddress);

      expect(contractBalance).to.be.equal(secondRoundTokensAmount);
    });

    it("should mint tokens to platform for the first round", async () => {
      await tokenMarketplace.startSaleRound();

      expect(await token.balanceOf(tokenMarketplace.address)).to.be.above(0);
    });
  });

  describe("buyOnSaleRound", async () => {
    it("should mint tokens to platform for the first round", async () => {
      await tokenMarketplace.startSaleRound();

      const amount = ethers.utils.parseUnits("1", 16);
      const contractBalance = await token.balanceOf(tokenMarketplace.address);

      await tokenMarketplace.connect(bob).buyOnSaleRound({
        value: amount,
      });

      expect(
        await token.balanceOf(tokenMarketplace.address),
        "Contract balance does not change"
      ).to.be.equal(contractBalance.sub(await token.balanceOf(bob.address)));

      expect(
        await token.balanceOf(bob.address),
        "User balance does not change"
      ).to.be.above(0);
    });
  });

  describe("createBid", async () => {
    it("should revert if not enough tokens to sell", async () => {
      await tokenMarketplace.startSaleRound();

      const amount = ethers.utils.parseEther("0.02");
      const smallAmount = ethers.utils.parseEther("0.01");

      await tokenMarketplace.connect(bob).buyOnSaleRound({
        value: smallAmount,
      });

      const tokensAmount = convertEthToTokensString(amount, tokenInitialPrice);

      await expect(
        tokenMarketplace.connect(bob).createBid(tokensAmount, tokenInitialPrice)
      ).to.be.revertedWith("Marketpalce: You don't have enough tokens to sell");
    });

    it("should be able to create a bid", async () => {
      const amount = ethers.utils.parseEther("0.02");
      const tokensAmount = convertEthToTokensBigNumber(
        amount,
        tokenInitialPrice
      );

      await tokenMarketplace.startSaleRound();

      await tokenMarketplace.connect(bob).buyOnSaleRound({
        value: amount,
      });

      await token.connect(bob).approve(tokenMarketplace.address, tokensAmount);

      await tokenMarketplace
        .connect(bob)
        .createBid(tokensAmount, tokenInitialPrice);

      const bids = await tokenMarketplace.getBids();
      const [_seller, _amount, _price] = bids[0];

      expect([_seller, _amount, _price]).to.deep.equal([
        bob.address,
        tokensAmount,
        tokenInitialPrice,
      ]);
    });
  });

  describe("trade", async () => {
    it("should be able to buy tokens", async () => {
      const amount = ethers.utils.parseEther("0.5");
      const smallAmount = ethers.utils.parseEther("0.1");
      const sellPrice = ethers.utils.parseEther("0.00008");
      const tokensAmount = convertEthToTokensBigNumber(
        amount,
        tokenInitialPrice
      );
      const smallTokensAmount = convertEthToTokensBigNumber(
        smallAmount,
        tokenInitialPrice
      );

      await tokenMarketplace.startSaleRound();

      await tokenMarketplace.connect(bob).buyOnSaleRound({
        value: amount,
        ...gasOptions,
      });

      await token.connect(bob).approve(tokenMarketplace.address, tokensAmount);

      await tokenMarketplace.connect(bob).createBid(tokensAmount, sellPrice);

      const balanceBobBeforeSale = await bob.getBalance();

      await tokenMarketplace.connect(alice).trade(0, smallTokensAmount, {
        value: convertTokensToEthBigNumber(smallTokensAmount, sellPrice),
      });

      const balanceBobAfterSale = await bob.getBalance();

      expect(balanceBobAfterSale).to.be.equal(
        balanceBobBeforeSale.add(
          convertTokensToEthBigNumber(smallTokensAmount, sellPrice)
        )
      );
    });
  });
});
