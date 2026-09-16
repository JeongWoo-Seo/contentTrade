import { createHash } from "node:crypto";

export type TransactionSubmissionResultType =
  | "SUCCESS"
  | "RPC_ERROR"
  | "PROOF_INVALID";

export interface TransactionSubmissionInput {
  jobId: string;
  proof: string; // snarkjs Groth16 Proof (JSON string)
  publicSignals: string[];
}

export type TransactionSubmissionResult =
  | {
      result: "SUCCESS";
      txHash: string;
    }
  | {
      result: "RPC_ERROR";
      reason: string;
    }
  | {
      result: "PROOF_INVALID";
      reason: string;
    };

export interface ReceiptCheckResult {
  confirmed: boolean;
}

/**
 * stub 용 가짜 txHash. 실제 구현에서는 블록체인 tx hash 가 반환된다.
 * jobId 기반 고유값으로 만들어 UNIQUE 제약을 위반하지 않는다.
 */
function fakeTxHash(jobId: string): string {
  return "0x" + createHash("sha256").update(jobId).digest("hex");
}

/**
 * 컨텐츠 등록 트랜잭션 시뮬레이션 + 전송.
 * 실제 EVM 시뮬레이션과 블록체인 전송은 아직 구현하지 않는다.
 */
export async function simulateAndSubmitContentRegistration(
  input: TransactionSubmissionInput,
): Promise<TransactionSubmissionResult> {
  // TODO: 1) EVM 시뮬레이션 (viem: estimateGas 등)
  //       2) 실제 블록체인 전송 (컨트랙트 호출 → txHash)
  console.log(`[blockchain] simulateAndSubmitContentRegistration jobId=${input.jobId}`);

  return { result: "SUCCESS", txHash: fakeTxHash(input.jobId) };
}

/**
 * 거래 승인 트랜잭션 시뮬레이션 + 전송.
 * 실제 EVM 시뮬레이션과 블록체인 전송은 아직 구현하지 않는다.
 */
export async function simulateAndSubmitTradeApproval(
  input: TransactionSubmissionInput,
): Promise<TransactionSubmissionResult> {
  // TODO: 1) EVM 시뮬레이션 2) 실제 블록체인 전송
  console.log(`[blockchain] simulateAndSubmitTradeApproval jobId=${input.jobId}`);

  return { result: "SUCCESS", txHash: fakeTxHash(input.jobId) };
}

/**
 * 컨텐츠 등록 트랜잭션 영수증 확인.
 * 실제 블록체인 RPC 호출은 아직 구현하지 않는다.
 */
export async function checkContentRegistrationReceipt(txHash: string): Promise<ReceiptCheckResult> {
  // TODO: 실제 영수증 조회 (viem: getTransactionReceipt)
  console.log(`[blockchain] checkContentRegistrationReceipt txHash=${txHash}`);

  return { confirmed: true };
}

/**
 * 거래 승인 트랜잭션 영수증 확인.
 * 실제 블록체인 RPC 호출은 아직 구현하지 않는다.
 */
export async function checkTradeApprovalReceipt(txHash: string): Promise<ReceiptCheckResult> {
  // TODO: 실제 영수증 조회
  console.log(`[blockchain] checkTradeApprovalReceipt txHash=${txHash}`);

  return { confirmed: true };
}
