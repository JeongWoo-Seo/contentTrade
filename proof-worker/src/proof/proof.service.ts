import { ContentEncryptionResult } from "../crypto/content-encryption.js";
import { groth16 } from "snarkjs";
import { DecryptedTradeOrder } from "../service/proof.service.js";
import { EncResult } from "../crypto/encryption.js";

const CONTENT_REGISTRATION_WASM = "artifacts/regist_content/regist_content.wasm";
const CONTENT_REGISTRATION_ZKEY = "artifacts/regist_content/regist_content_final.zkey";
const TRADE_APPROVAL_WASM = "artifacts/approve_trade/approve_trade.wasm";
const TRADE_APPROVAL_ZKEY = "artifacts/approve_trade/approve_trade_final.zkey";

export interface TradeApprovalProofInput {
  cmAuth: string;
  cmSvr: string;
  pkOwnSvr: bigint;
  order: DecryptedTradeOrder;
  cipher: EncResult;
  dataEncKey: bigint;
}

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

export async function generateProofForContentRegistration(
  input: ContentEncryptionResult,
): Promise<ProofOutcome> {
  const circuitInput = {
    pk_own: input.pk_own,
    h_k: input.hK,
    h_ct: input.hCt,
    h_data: input.hData,

    // Private Inputs (witness 필드 접근)
    dataEncKey: input.witness.dataEncKey,
    data: input.witness.data,
    CT_data: input.witness.CT_data,
    CT_r: input.witness.CT_r,
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

/**
 * approve_trade 회로 입력(circuitInput)을 생성한다.
 * handleTradeApproval 흐름의 decrypted order + cipher + dataEncKey로부터 조립한다.
 */
export function buildTradeApproveCircuitInput(
  input: TradeApprovalProofInput,
): Record<string, unknown> {
  return {
    // Public
    cm_auth: input.cmAuth,
    cm_svr: input.cmSvr,
    c0: [input.cipher.ciphertext.c0[0].toString(), input.cipher.ciphertext.c0[1].toString()],
    c1: input.cipher.ciphertext.c1.toString(),
    c2: input.cipher.ciphertext.c2[0].toString(),

    // Prover witness
    r_cm: input.order.r_cm.toString(),
    h_k: input.order.h_k.toString(),
    fee_auth: input.order.fee_auth.toString(),
    fee_svr: input.order.fee_svr.toString(),
    data_enc_key: input.dataEncKey.toString(),
    pk_enc_cons: [input.order.pk_enc_cons[0].toString(), input.order.pk_enc_cons[1].toString()],
    pk_own_auth: input.order.pk_own_auth.toString(),
    pk_own_svr: input.pkOwnSvr.toString(),
    r_enc: input.cipher.r_enc.toString(),
    k_enc: input.cipher.k_enc.toString(),
  };
}

export async function generateProofForTradeApprove(
  input: TradeApprovalProofInput,
): Promise<ProofOutcome> {
  const circuitInput = buildTradeApproveCircuitInput(input);

  try {
    const { proof, publicSignals } = await groth16.fullProve(
      circuitInput,
      TRADE_APPROVAL_WASM,
      TRADE_APPROVAL_ZKEY,
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