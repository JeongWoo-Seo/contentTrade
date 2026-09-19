import { ethers } from "ethers";
import { env } from "../config/env.js";

export const provider = new ethers.JsonRpcProvider(
  env.ethereumRpcUrl,
);

export const wallet = new ethers.Wallet(
  env.blockchainPrivateKey,
  provider,
);

export const contentTradeContract = new ethers.Contract(
  env.contentTradeContractAddress,
  [
    // TODO:
    // 실제 ContentTrade ABI
  ],
  wallet,
);