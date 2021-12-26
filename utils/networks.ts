import "dotenv/config";
import "@nomiclabs/hardhat-ethers";

import dotenv from "dotenv";
import fs from "fs";

export const getConfig = (
  network: string
): {
  mnemonic: string;
  tokenName: string;
  tokenAddress: string;
  daoAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
} => {
  let envConfig;

  try {
    envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
  } catch (e) {
    envConfig = {};
  }

  for (const parameter in envConfig) {
    process.env[parameter] = envConfig[parameter];
  }

  return {
    mnemonic: process.env.MNEMONIC_RINKEBY || "",
    tokenName: process.env.TOKEN_NAME || "",
    tokenAddress: process.env.TOKEN_ADDRESS || "",
    tokenSymbol: process.env.TOKEN_SYMBOL || "",
    daoAddress: process.env.DAO_ADDRESS || "",
    tokenDecimals: Number(process.env.TOKEN_DECIMALS) || 18,
  };
};
