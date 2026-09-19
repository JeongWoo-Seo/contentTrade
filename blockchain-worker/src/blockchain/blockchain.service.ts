import { ethers } from "ethers";
import { provider, wallet, contentTradeContract } from "./blockchian.js";
import { TransactionInput, SignedTransaction, Eip1559Fee, ReceiptCheckResult } from "./type.js";


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



/**
 * Content Registration 트랜잭션 receipt 확인
 */
export async function checkContentRegistrationReceipt(
  txHash: string,
): Promise<ReceiptCheckResult> {
  return checkTransactionReceipt(txHash);
}

/**
 * Trade Approval 트랜잭션 receipt 확인
 */
export async function checkTradeApprovalReceipt(
  txHash: string,
): Promise<ReceiptCheckResult> {
  return checkTransactionReceipt(txHash);
}

/**
 * Ethereum transaction receipt 확인
 *
 * receipt == null
 *   -> 아직 pending
 *
 * receipt.status === 1
 *   -> transaction 성공
 *
 * receipt.status === 0
 *   -> transaction revert
 */
async function checkTransactionReceipt(
  txHash: string,
): Promise<ReceiptCheckResult> {
  if (!txHash) {
    throw new Error("Transaction hash is required");
  }

  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return {
      confirmed: false,
      failed: false,
      transactionHash: txHash,
    };
  }

  // 성공
  if (receipt.status === 1) {
    return {
      confirmed: true,
      failed: false,
      status: receipt.status,
      transactionHash: receipt.hash,
    };
  }

  // EVM 실행 실패
  return {
    confirmed: false,
    failed: true,
    status: receipt.status,
    transactionHash: receipt.hash,
  };
}