import { ethers } from "ethers";
import {
  provider,
  wallet,
  contentTradeContract,
} from "./blockchian.js";

export type TransactionInput = {
  to: string;
  data: string;
  nonce: number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  value?: bigint;
};

export type SignedTransaction = {
  signedTx: string;
  txHash: string;
};

export type SubmittedTransaction = {
  txHash: string;
  nonce: number;
};

export async function getPendingNonce(): Promise<number> {
  return provider.getTransactionCount(
    wallet.address,
    "pending",
  );
}

export async function signTransaction(
  transaction: TransactionInput,
): Promise<SignedTransaction> {
  const signedTx = await wallet.signTransaction(transaction);
  const txHash = ethers.keccak256(signedTx);
  return {
    signedTx,
    txHash,
  };
}

export async function broadcastTransaction(
  signedTx: string,
): Promise<void> {
  await provider.broadcastTransaction(signedTx);
}

export async function getTransaction(
  txHash: string,
): Promise<ethers.TransactionResponse | null> {
  return provider.getTransaction(txHash);
}

export async function getTransactionReceipt(
  txHash: string,
): Promise<ethers.TransactionReceipt | null> {
  return provider.getTransactionReceipt(txHash);
}

export async function simulateContentRegistration(
  proof: string,
  publicSignals: string,
): Promise<void> {
  await contentTradeContract.registerContent.staticCall(
    proof,
    publicSignals,
  );
}

export async function simulateTradeApproval(
  proof: string,
  publicSignals: string,
): Promise<void> {
  await contentTradeContract.tradeApproval.staticCall(
    proof,
    publicSignals,
  );
}

export type Eip1559Fee = {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export async function getEip1559Fee(): Promise<Eip1559Fee> {
  const feeData = await provider.getFeeData();
  if (feeData.maxFeePerGas === null || feeData.maxPriorityFeePerGas === null
  ) {
    throw new Error("EIP-1559 fee data is unavailable");
  }
  return {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  };
}

export async function estimateGas(
  transaction: {
    to: string;
    data: string;
    value?: bigint;
  },
): Promise<bigint> {
  return provider.estimateGas({
    from: wallet.address,
    to: transaction.to,
    data: transaction.data,
    value: transaction.value ?? 0n,
  });
}

export function addGasMargin(
  gas: bigint,
  percentage = 20,
): bigint {
  return (gas * BigInt(100 + percentage)) / 100n;
}