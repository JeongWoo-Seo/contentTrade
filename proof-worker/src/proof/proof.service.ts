import { ContentEncryptionResult } from "../crypto/encryption.js";
import { groth16 } from "snarkjs";

const CONTENT_REGISTRATION_WASM = "artifacts/regist-content/regist-content.wasm";
const CONTENT_REGISTRATION_ZKEY = "artifacts/regist-content/regist-content_final.zkey";

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
  publicSignals: string;
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

  if (input.proofType !== "CONTENT_REGISTRATION") {
    return {
      success: false,
      reason: `Unsupported proof type: ${input.proofType}`,
    };
  }

  const encryption = input.encryption;

  const circuitInput = {
    pk_own: encryption.pk_own,
    h_k: encryption.hK,
    h_ct: encryption.hCt,
    h_data: encryption.hData,

    // Private Inputs (witness 필드 접근)
    dataEncKey: encryption.witness.dataEncKey,
    data: encryption.witness.data,
    CT_data: encryption.witness.CT_data,
    CT_r: encryption.witness.CT_r,
  };

  try {
    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      CONTENT_REGISTRATION_WASM,
      CONTENT_REGISTRATION_ZKEY,
    );

    return {
      success: true,

      result: {
        proof: JSON.stringify(proof),
        publicSignals: JSON.stringify(publicSignals),
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // SnarkJS 및 Witness 생성 시 발생하는 대표적 제약조건 오류 검사
    const isCircuitValidationFailure =
      errorMessage.includes("Assert Failed") ||
      errorMessage.includes("Error in template") ||
      errorMessage.includes("Signal not found") ||
      errorMessage.includes("Not enough signals");

    if (isCircuitValidationFailure) {
      return {
        success: false,
        reason: `Circuit constraint failed: ${errorMessage}`,
      };
    }

    // 2. 파일 로드 실패(ENOENT), OOM, WASM 크래시 등 일시적 시스템 오류
    // 외부 재시도 메커니즘(p-retry, Kafka 등)이 에러를 감지할 수 있도록 그대로 던짐
    throw error;
  }
}