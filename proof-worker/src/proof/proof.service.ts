import { ContentEncryptionResult } from "../crypto/encryption.js";

export interface ContentRegistrationProofInput {
  proofType: "CONTENT_REGISTRATION" | "TRADE_APPROVAL";
  originalText: string;
  encryption: ContentEncryptionResult;
}

export interface TradeApprovalProofInput {
  proofType: "TRADE_APPROVAL";
  purchaseId: number;
}

export type ProofInput = ContentRegistrationProofInput | TradeApprovalProofInput;

export interface ProofResult {
  proof: string;
  publicSignals: string[];
}

export type ProofOutcome =
  | {
    success: true;
    result: ProofResult;
  }
  | {
    success: false;
    reason: string;
  };

export async function generateProof(
  input: ProofInput,
): Promise<ProofOutcome> {
  // TODO: 실제 ZK Proof 생성 구현

  console.log(
    `[proof] generateProof input=${JSON.stringify(input)}`,
  );

  // 예:
  // 입력값 검증 실패 → success: false
  //
  // if (...) {
  //   return {
  //     success: false,
  //     reason: "Invalid proof input",
  //   };
  // }

  // TODO: 실제 proof 생성
  return {
    success: true,
    result: {
      proof: `test-proof-${input.proofType}-${Date.now()}`,
      publicSignals: [],
    },
  };
}