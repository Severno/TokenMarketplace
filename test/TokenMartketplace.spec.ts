import "@nomiclabs/hardhat-ethers";

import { AcademyToken, AcademyToken__factory } from "../typechain-types";
import { BigNumber, Contract, Transaction } from "ethers";

import { BaseProvider } from "@ethersproject/providers";
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

let Token: AcademyToken__factory;
let token: AcademyToken;
let tokenAddress: string;

let TokenMarketplace;
let mp: Contract;
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

function getTransactionFee(tx: Transaction): BigNumber {
  return tx?.gasPrice || BigNumber.from(0);
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
    mp = await TokenMarketplace.deploy(token.address);

    token.grantRole(MINTER_ROLE, mp.address);
    token.grantRole(BURNER_ROLE, mp.address);
    token.grantRole(ADMIN_ROLE, mp.address);

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
    tokenMarketplaceAddress = mp.address;

    console.log("tokenAddress:", token.address);
    console.log("aliceAddress:", alice.address);
    console.log("bobAddress:", bob.address);
    console.log("smithAddress:", smith.address);
    console.log("tokenMarketplaceAddress:", mp.address);
  });

  /* -------------------------------------------------------------------------- */
  /*                                registration                                */
  /* -------------------------------------------------------------------------- */
  describe("registration", async () => {
    /* -------------------------------------------------------------------------- */
    it("should revert if zero address", async () => {
      await expect(mp.registration(zeroAddress)).to.be.revertedWith(
        "Marketplace: Referral can't be a zero address"
      );
    });
    /* -------------------------------------------------------------------------- */
    it("should revert if referral is the user", async () => {
      await expect(
        mp.connect(bob).registration(bob.address)
      ).to.be.revertedWith(
        "Marketplace: You can't choose yourself as a referral"
      );
    });

    /* -------------------------------------------------------------------------- */
    it("should be registered after registration and has referral as address", async () => {
      await mp.connect(bob).registration(smith.address);

      const registrationAddress = await mp.registrations(bob.address);

      expect(smith.address).to.be.equal(registrationAddress);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               startSaleRound                               */
  /* -------------------------------------------------------------------------- */
  describe("startSaleRound", async () => {
    it("should revert if is not an admin", async () => {
      await expect(mp.connect(bob).startSaleRound()).to.be.revertedWith(
        "Marketplace: You are not an admin"
      );
    });

    it(`should mint ${firstRoundTokensAmount} tokens for the first round`, async () => {
      await mp.startSaleRound();
      const tokenMarketplaceACDMTokensBalance = await token.balanceOf(
        tokenMarketplaceAddress
      );

      expect(tokenMarketplaceACDMTokensBalance).to.be.equal(
        BigNumber.from(firstRoundTokensAmount)
      );
    });

    it(`should mint ${secondRoundTokensAmount} tokens for the second round`, async () => {
      await mp.startSaleRound();

      const value = ethers.utils.parseEther("0.5");
      const price = ethers.utils.parseEther("0.00001");
      const tradeRoundTokenPrice = ethers.utils.parseEther("0.00008");

      await token
        .connect(bob)
        .approve(mp.address, convertEthToTokensBigNumber(value, price));

      await mp.connect(bob).buyToken({
        value,
      });

      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await mp.endSaleRound();
      const bobTokensBalance = await token.balanceOf(bobAddress);
      await mp.connect(bob).createBid(bobTokensBalance, tradeRoundTokenPrice);
      await mp.connect(alice).trade(0, bobTokensBalance, {
        value: tradeRoundTokenPrice.mul(bobTokensBalance),
      });

      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);

      await mp.endTradeRound();
      await mp.startSaleRound();

      const contractBalance = await token.balanceOf(tokenMarketplaceAddress);

      expect(contractBalance).to.be.equal(secondRoundTokensAmount);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                endSaleRound;                               */
  /* -------------------------------------------------------------------------- */
  describe("endSaleRound", async () => {
    /* -------------------------------------------------------------------------- */
    it("should revert if is not an admin", async () => {
      await mp.startSaleRound();

      await expect(mp.connect(bob).endSaleRound()).to.be.revertedWith(
        "Marketplace: You are not an admin"
      );
    });
    /* -------------------------------------------------------------------------- */
    it("should revert if sale round is not finished yet", async () => {
      await mp.startSaleRound();

      await expect(mp.endSaleRound()).to.be.revertedWith(
        "Martketplace: Sale round time is not finished yet"
      );
    });
    /* -------------------------------------------------------------------------- */
    it("should burn unredeemed tokens", async () => {
      await mp.startSaleRound();
      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);

      const contractBalanceBeforeBurning = await token.balanceOf(
        tokenMarketplaceAddress
      );

      expect(
        contractBalanceBeforeBurning,
        `Token balance should be ${firstRoundTokensAmount}`
      ).to.be.equal(firstRoundTokensAmount);

      await mp.endSaleRound();

      const contractBalanceAfterBurning = await token.balanceOf(
        tokenMarketplaceAddress
      );

      expect(
        contractBalanceAfterBurning,
        `Token balance should be 0`
      ).to.be.equal(0);
    });
    /* -------------------------------------------------------------------------- */
    it("endSaleRound should startTradeRound", async () => {
      await mp.startSaleRound();
      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);
      await mp.endSaleRound();

      const [, , isActive] = await mp.tradeRounds(0);

      expect(isActive).to.be.true;
    });
    /* -------------------------------------------------------------------------- */
  });

  /* -------------------------------------------------------------------------- */
  /*                               buyToken;                              */
  /* -------------------------------------------------------------------------- */

  describe("buyToken", async () => {
    /* -------------------------------------------------------------------------- */
    it("should be able to buy tokens", async () => {
      await mp.startSaleRound();

      const value = ethers.utils.parseEther("0.5");
      const contractBalance = await token.balanceOf(mp.address);

      await mp.connect(bob).buyToken({
        value,
      });

      expect(
        await token.balanceOf(mp.address),
        "Contract balance does not change"
      ).to.be.equal(contractBalance.sub(await token.balanceOf(bob.address)));

      expect(
        await token.balanceOf(bob.address),
        `User balance becomes ${convertEthToTokensBigNumber(
          value,
          tokenInitialPrice
        )}`
      ).to.be.equal(convertEthToTokensBigNumber(value, tokenInitialPrice));
    });

    it("contract should get all ETH if there is no referrer", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const contractTreasure = value;

      await expect(
        await mp.connect(smith).buyToken({
          value,
        })
      ).to.changeEtherBalances(
        [smith, mp],
        [(-value).toString(), contractTreasure]
      );
    });
    it("contract should get 95% ETH if there is one referrer", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const aliceTreasure = value.sub(value.div(100).mul(95));
      const contractTreasure = value.div(100).mul(95);

      await mp.connect(smith).registration(aliceAddress);

      await expect(
        await mp.connect(smith).buyToken({
          value,
        })
      ).to.changeEtherBalances(
        [smith, alice, mp],
        [(-value).toString(), aliceTreasure, contractTreasure]
      );
    });

    it("contract should get 92% ETH if there are two referrers", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const bobTreasure = value.sub(value.div(100).mul(97));
      const aliceTreasure = value.sub(value.div(100).mul(95));
      const contractTreasure = value.div(100).mul(92);

      await mp.connect(alice).registration(bobAddress);
      await mp.connect(smith).registration(aliceAddress);

      await expect(
        await mp.connect(smith).buyToken({
          value,
        })
      ).to.changeEtherBalances(
        [smith, alice, bob, mp],
        [(-value).toString(), aliceTreasure, bobTreasure, contractTreasure]
      );
    });

    /* -------------------------------------------------------------------------- */
    it("should distribute ETH to first referral", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      await mp.connect(alice).registration(bobAddress);
      const bobTreasure = value.sub(value.div(100).mul(95));
      const contractTreasure = value.div(100).mul(95);

      await expect(
        await mp.connect(alice).buyToken({
          value,
        })
      ).to.changeEtherBalances(
        [alice, bob, mp],
        [(-value).toString(), bobTreasure, contractTreasure]
      );
    });

    it("should distribute ETH for two level referral", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const bobTreasure = value.sub(value.div(100).mul(97));

      await mp.connect(alice).registration(bobAddress);
      await mp.connect(smith).registration(aliceAddress);

      await expect(
        await mp.connect(smith).buyToken({
          value,
        })
      ).to.changeEtherBalance(bob, bobTreasure);
    });
    /* -------------------------------------------------------------------------- */
  });

  /* -------------------------------------------------------------------------- */
  /*                                    trade                                   */
  /* -------------------------------------------------------------------------- */
  describe("trade", async () => {
    it("should revert if trade round doesn't start yet", async () => {
      await expect(
        mp
          .connect(bob)
          .trade(
            0,
            convertEthToTokensBigNumber(
              ethers.utils.parseEther("0.5"),
              tokenInitialPrice
            )
          )
      ).to.be.revertedWith("Marketplace: Trade round is not started yet");
    });

    it("should revert if user wants to buy more tokens than bid specified", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const tokensAmount = convertEthToTokensBigNumber(
        value,
        tokenInitialPrice
      );
      const tokenPriceAfterSale = ethers.utils.parseEther("0.00008");
      const contractBalance = await token.balanceOf(mp.address);

      await mp.connect(bob).buyToken({
        value,
      });
      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);
      await mp.endSaleRound();

      await token.connect(bob).approve(mp.address, tokensAmount);

      await mp.connect(bob).createBid(tokensAmount, tokenPriceAfterSale);

      await expect(
        mp.connect(alice).trade(0, tokensAmount.add(tokensAmount), {
          value: convertTokensToEthBigNumber(tokensAmount, tokenPriceAfterSale),
        })
      ).to.be.revertedWith(
        "Marketplace: You can't buy more tokens than bid specified"
      );
    });

    it("should top up user balance", async () => {
      await mp.startSaleRound();
      const value = ethers.utils.parseEther("0.5");
      const tokensAmount = convertEthToTokensBigNumber(
        value,
        tokenInitialPrice
      );
      const tokenPriceAfterSale = ethers.utils.parseEther("0.00008");
      const tradeEthValue = convertTokensToEthBigNumber(
        tokensAmount,
        tokenPriceAfterSale
      );

      await mp.connect(bob).buyToken({
        value,
      });
      await ethers.provider.send("evm_increaseTime", [threeDaysInSeconds]);
      await ethers.provider.send("evm_mine", []);
      await mp.endSaleRound();

      await token.connect(bob).approve(mp.address, tokensAmount);

      await mp.connect(bob).createBid(tokensAmount, tokenPriceAfterSale);

      await expect(
        await mp.connect(alice).trade(0, tokensAmount, {
          value: tradeEthValue,
        })
      ).to.changeEtherBalances(
        [alice, bob, mp],
        [
          (-tradeEthValue).toString(),
          tradeEthValue.div(100).mul(95),
          tradeEthValue.sub(tradeEthValue.div(100).mul(95)),
        ]
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                  createBid                                 */
  /* -------------------------------------------------------------------------- */

  describe("createBid", async () => {
    it("should revert if not enough tokens to sell", async () => {
      await mp.startSaleRound();

      const value = ethers.utils.parseEther("0.02");
      const smallAmount = ethers.utils.parseEther("0.01");

      await mp.connect(bob).buyToken({
        value: smallAmount,
      });

      const tokensAmount = convertEthToTokensString(value, tokenInitialPrice);

      await expect(
        mp.connect(bob).createBid(tokensAmount, tokenInitialPrice)
      ).to.be.revertedWith("Marketplace: You don't have enough tokens to sell");
    });

    it("should be able to create a bid", async () => {
      const value = ethers.utils.parseEther("0.02");
      const tokensAmount = convertEthToTokensBigNumber(
        value,
        tokenInitialPrice
      );

      await mp.startSaleRound();

      await mp.connect(bob).buyToken({
        value: value,
      });

      await token.connect(bob).approve(mp.address, tokensAmount);

      await mp.connect(bob).createBid(tokensAmount, tokenInitialPrice);

      const bids = await mp.getBids();
      const [_seller, _amount, _price] = bids[0];

      expect([_seller, _amount, _price]).to.deep.equal([
        bob.address,
        tokensAmount,
        tokenInitialPrice,
      ]);
    });
  });
});
