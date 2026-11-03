import { ethers, ZeroAddress } from "ethers";
import { provider, wallet, contentTradeContract } from "./blockchian.js";
import { TransactionInput, SignedTransaction, Eip1559Fee, ReceiptCheckResult, Groth16Proof } from "./type.js";

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

export async function simulateOnChain(
  proof: string,
  publicSignals: string,
): Promise<void> {
  const parsedProof = JSON.parse(proof) as Groth16Proof;

  let parsedPublicSignals: unknown = JSON.parse(publicSignals);

  // 이중 직렬화된 경우 한 번 더 파싱
  if (typeof parsedPublicSignals === "string") {
    parsedPublicSignals = JSON.parse(parsedPublicSignals);
  }

  if (
    !Array.isArray(parsedPublicSignals) || parsedPublicSignals.length !== 4 ||
    !parsedPublicSignals.every((signal) => typeof signal === "string")) {
    throw new Error(
      `Expected 4 public signals, got ${Array.isArray(parsedPublicSignals)
        ? parsedPublicSignals.length
        : typeof parsedPublicSignals
      }`,
    );
  }

  const a: [string, string] = [
    parsedProof.pi_a[0],
    parsedProof.pi_a[1],
  ];

  // snarkjs의 pi_b 좌표는 Solidity pairing 입력에 맞게 순서를 바꿉니다.
  const b: [[string, string], [string, string]] = [
    [parsedProof.pi_b[0][1], parsedProof.pi_b[0][0]],
    [parsedProof.pi_b[1][1], parsedProof.pi_b[1][0]],
  ];

  const c: [string, string] = [
    parsedProof.pi_c[0],
    parsedProof.pi_c[1],
  ];

  await contentTradeContract.registerContent.staticCall(
    a,
    b,
    c,
    parsedPublicSignals,
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
 * User Registration(회원가입) 트랜잭션 receipt 확인
 */
export async function checkAccountRegistrationReceipt(
  txHash: string,
  addr: string,
): Promise<ReceiptCheckResult> {
  // 1. 트랜잭션 Receipt 확인
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    // 아직 블록에 포함되지 않음
    return {
      status: "PENDING",
      txHash: txHash,
      reason: null,
    };
  }

  // 2. EVM 실행 실패 확인
  if (receipt.status !== 1) {
    return {
      status: "FAILED",
      reason: "Account registration transaction reverted",
      txHash: txHash,
    };
  }

  // 3. 트랜잭션 원본 조회
  const tx = await provider.getTransaction(txHash);

  if (!tx) {
    throw new Error(`Transaction not found: ${txHash}`);
  }

  // 5. registUser 호출인지 확인하고 addr 검증
  const parsed = contentTradeContract.interface.parseTransaction({
    data: tx.data,
    value: tx.value,
  });

  if (!parsed || parsed.name !== "registUser") {
    return {
      status: "FAILED",
      reason: "Transaction did not call registUser",
      txHash: txHash,
    };
  }

  const expectedAddr = BigInt(`0x${addr}`);
  const registeredAddr = BigInt(parsed.args[0].toString());

  if (registeredAddr !== expectedAddr) {
    return {
      status: "FAILED",
      reason: "Registered addr does not match requested addr",
      txHash,
    };
  }

  // 6. 컨트랙트의 실제 등록 정보 확인
  const userInfo = await contentTradeContract
    .getFunction("_userInfoMap")
    .staticCall(expectedAddr);

  if (userInfo.own === ZeroAddress) {
    return {
      status: "FAILED",
      reason: "User is not registered on-chain",
      txHash: txHash,
    };
  }

  // 모든 검증 통과
  return {
    status: "CONFIRMED",
    txHash: txHash,
    reason: null,
  };
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
      status: "PENDING",
      txHash: txHash,
      reason: null,
    };
  }

  // 성공
  if (receipt.status === 1) {
    return {
      status: "CONFIRMED",
      txHash: txHash,
      reason: null,
    };
  }

  // EVM 실행 실패
  return {
    status: "FAILED",
    reason: "transaction reverted",
    txHash: txHash,
  };
}