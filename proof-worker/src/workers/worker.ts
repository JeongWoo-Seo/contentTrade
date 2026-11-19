import type { Consumer } from "kafkajs";
import { createConsumer } from "../kafka/consumer.js";
import { env } from "../config/env.js";
import { decryptTradeOrder } from "../service/proof.service.js";
import type {
  ProofRequestedMessage,
  RegistrationProofRequestedMessage,
  TradeProofRequestedMessage,
} from "../kafka/types.js";
import os from "node:os";
import {
  createContentRegistrationProof,
  saveContentRegistrationWithRetry,
  findContentRegistrationByJobIdWithRetry,
  failJobOutboxWithRetry,
  findTradeApprovalByPurchaseIdWithRetry,
  createTradeApproveProof,
  claimTradeApprovalWithRetry,
  getTradeApprovalWithRetry,
  verifyTradeOrder,
  saveTradeApprovalWithRetry,
} from "../service/proof.service.js"
import { getContentRegistrationSourceWithRetry } from "../service/proof.service.js";
import { PublicCiphertext } from "../crypto/encryption.js";
import { unwrapDataEncKey } from "../crypto/key-wrapping.js";
import { parseFieldElement } from "../crypto/poseidon.js"; 

export class ProofWorker {
  readonly workerId: string;
  private consumer: Consumer | null = null;

  constructor(index: number) {
    this.workerId = `${env.kafkaClientIdPrefix}-${os.hostname()}-${index}`;
  }

  async start(): Promise<void> {
    this.consumer = createConsumer(this.workerId);

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: env.kafkaRequestTopic, fromBeginning: false });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          return;
        }

        let payload: ProofRequestedMessage;
        try {
          payload = JSON.parse(message.value.toString()) as ProofRequestedMessage;
        } catch (error) {
          console.error(`[${this.workerId}] invalid proof_requested message: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }

        await this.handle(payload);

        const nextOffset = String(Number(message.offset) + 1);
        await this.consumer?.commitOffsets([
          { topic, partition, offset: nextOffset },
        ]);
      },
    });

    console.log(`[${this.workerId}] started`);
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
    console.log(`[${this.workerId}] stopped`);
  }

  private async handle(
    message: ProofRequestedMessage,
  ): Promise<void> {
    console.log(`[${this.workerId}] received jobId=${message.jobId}, proofType=${message.jobType}`);

    try {
      if (message.jobType === "CONTENT_REGISTRATION") {
        await this.handleContentRegistration(message);
      }
      else if (message.jobType === "TRADE_APPROVAL") {
        await this.handleTradeApproval(message);
      } else {
        const error = new Error(`Unsupported proofType`);
        console.error(`[${this.workerId}] proof failed:`, error);
      }
    } catch (error) {
      console.error(`[${this.workerId}] proof failed jobId=${message.jobId}:`, error);

      throw error;
    }
  }

  private async handleContentRegistration(message: RegistrationProofRequestedMessage): Promise<void> {
    if (message.referenceId == null) {
      const error = new Error(`registrationId is null`);
      const reason = error instanceof Error ? error.message : String(error);
      await failJobOutboxWithRetry(message, reason);
      return;
    }

    // idempotency: 이미 처리된 job은 proof를 재생성하지 않는다.
    const existing = await findContentRegistrationByJobIdWithRetry(message.jobId);
    if (existing) {
      console.log(`[${this.workerId}] already processed, skip jobId=${message.jobId}`);
      return;
    }

    //grpc get job data
    console.log(`[${this.workerId}] fetching data via gRPC, jobId=${message.jobId}`);
    const source = await getContentRegistrationSourceWithRetry(message.referenceId, message.jobId);

    // generate proof
    console.log(`[${this.workerId}] proof generation started`);
    const proof = await createContentRegistrationProof({
      jobId: message.jobId,
      registrationId: message.referenceId,
      originalText: source.originalText,
      authorPkOwn: source.authorPkOwn
    });
    // proof 생성 실패 시
    if (!proof.success) {
      const error = new Error(proof.reason);
      const reason = error instanceof Error ? error.message : String(error);
      await failJobOutboxWithRetry(message, reason);
      console.log(`[${this.workerId}] proof generation failed, jobId=${message.jobId}`);
      return;
    }
    console.log(`[${this.workerId}] proof generation completed`);

    // Proof 결과 DB 저장 (jobId unique constraint로 race condition 방지)
    try {
      await saveContentRegistrationWithRetry({
        jobId: message.jobId,
        registrationId: message.referenceId,
        result: proof.result,
      });

    } catch (error) {
      if (isUniqueViolation(error)) {
        // 다른 worker가 이미 생성함 → 중복 처리 방지
        console.log(`[${this.workerId}] already created by another worker, skip jobId=${message.jobId}`);
        return;
      }
      throw error;
    }
  }

  private async handleTradeApproval(message: TradeProofRequestedMessage): Promise<void> {
    if (message.referenceId == null) {
      console.error(`purchaseId is required: jobId=${message.jobId}`);
      return;
    }

    // 1. 구매 요청 tx 정보가 DB에 저장되어 있는지 확인하고
    //    Proof 생성 작업이 아직 진행되지 않았는지 확인
    const existing = await findTradeApprovalByPurchaseIdWithRetry(message.referenceId);

    // ① DB 정보가 없는 경우 → 오류 처리 (존재하지 않는 거래는 Proof 작업을 진행하지 않는다)
    if (!existing) {
      console.error(`Trade approval transaction not found: purchaseId=${message.referenceId}`);
      return;
    }

    // ③ 동일한 작업 ID인 경우 → 중복 요청 무시
    if (existing.approvalJobId === message.jobId) {
      console.log(`[${this.workerId}] duplicate trade approval request, skip jobId=${message.jobId} purchaseId=${message.referenceId}`);
      return;
    }

    // 2. c0, c1 복호화
    const tradeDataParsed = JSON.parse(existing.tradeData);
    const cipher: PublicCiphertext = {
      c0: [
        BigInt(tradeDataParsed.c0[0]),
        BigInt(tradeDataParsed.c0[1]),
      ],
      c1: BigInt(tradeDataParsed.c1_svr),
      c2: tradeDataParsed.c2.map((value: string) => BigInt(value))
    };
    const decrypted = await decryptTradeOrder(cipher, BigInt(env.skEncSvr));

    // 3. 거래 승인 과정에 필요한 정보를 gRPC로 가져오기
    console.log(`[${this.workerId}] fetching data via gRPC, jobId=${message.jobId}`);
    const tradeVerificationData = await getTradeApprovalWithRetry(message.referenceId, message.jobId);

    // 4. 거래 요청 확인 (cm, h_k 일치 여부 검증)
    const pkOwnAuth = parseFieldElement(tradeVerificationData.pkOwnAuth);
    const pkOwnSvr = parseFieldElement(env.pkOwn);

    const verification = verifyTradeOrder({
      decrypted,
      cmSvr: tradeDataParsed.cm_svr,
      cmAuth: tradeDataParsed.cm_auth,
      price: BigInt(tradeVerificationData.price),
      hK: tradeVerificationData.hK,
      pkEncCons: tradeVerificationData.pkEncCons,
      pkOwnSvr,
      pkOwnAuth
    });
    if (!verification.success) {
      const error = new Error(verification.reason);
      const reason = error instanceof Error ? error.message : String(error);
      await failJobOutboxWithRetry(message, reason);
      console.log(`[${this.workerId}] proof generation failed, jobId=${message.jobId}`);
      return;
    }

    // 5. 컨텐츠 암호화 키 복호화
    const dataEncKey = unwrapDataEncKey(
      tradeVerificationData.encryptedDataEncKey,
      Buffer.from(env.masterKey, "base64"),
    );

    // 6. Proof 생성
    console.log(`[${this.workerId}] proof generation started`);
    const proof = await createTradeApproveProof({
      jobId: message.jobId,
      buyHistoryId: message.referenceId,
      cmAuth: tradeDataParsed.cm_auth,
      cmSvr: tradeDataParsed.cm_svr,
      pkOwnSvr ,
      decrypted,
      dataEncKey
    });
    // proof 생성 실패 시
    if (!proof.success) {
      const error = new Error(proof.reason);
      const reason = error instanceof Error ? error.message : String(error);
      await failJobOutboxWithRetry(message, reason);
      console.log(`[${this.workerId}] proof generation failed, jobId=${message.jobId}`);
      return;
    }
    console.log(`[${this.workerId}] proof generation completed`);

    // 7. 작업 결과 저장 (proof, publicSignals, approvalJobId)
    //    및 Transaction Worker를 위한 Outbox 생성
    try {
      await saveTradeApprovalWithRetry({
        purchaseId: message.referenceId,
        jobId: message.jobId,
        proof: proof.result.proof,
        publicSignals: proof.result.publicSignals,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        console.log(`[${this.workerId}] already created by another worker, skip jobId=${message.jobId}`);
        return;
      }
      throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
