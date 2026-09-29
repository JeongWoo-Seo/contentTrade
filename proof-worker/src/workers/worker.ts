import type { Consumer } from "kafkajs";
import { createConsumer } from "../kafka/consumer.js";
import { sendProofFailed, sendBlockchainTransaction } from "../kafka/producer.js";
import { getContentRegistrationSource } from "../grpc/market.client.js";
import { generateProof } from "../proof/proof.service.js";
import { transactionRepository } from "../repositories/transaction.repository.js";
import { env } from "../config/env.js";
import type {
  ProofRequestedMessage,
  RegistrationProofRequestedMessage,
  TradeProofRequestedMessage,
  JobFailedMessage,
} from "../kafka/types.js";
import os from "node:os";
import { createContentRegistrationProof, saveContentRegistrationTransaction } from "../service/transaction.service.js"

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
          console.error(`[${this.workerId}] invalid PROOF_REQUESTED message: ${error instanceof Error ? error.message : String(error)}`);
          return;
        }

        await this.handle(payload);

        // 실패 시에도 PROOF_FAILED로 보고했으므로 offset을 commit한다(무한 재시도 방지).
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
    console.log(`[${this.workerId}] received jobId=${message.jobId}, proofType=${message.proofType}`);

    try {
      if (message.proofType === "CONTENT_REGISTRATION") {
        await this.handleContentRegistration(message);
      }
      else if (message.proofType === "TRADE_APPROVAL") {
        await this.handleTradeApproval(message);
      } else {
        const error = new Error(`Unsupported proofType`);
        await this.sendFailed(message, error);
      }
    } catch (error) {
      console.error(`[${this.workerId}] proof failed jobId=${message.jobId}:`, error);

      throw error;
    }
  }

  private async handleContentRegistration(message: RegistrationProofRequestedMessage): Promise<void> {
    if (message.registrationId == null) {
      const error = new Error(`registrationId is null`);
      await this.sendFailed(message, error);
      return;
    }

    // idempotency: 이미 처리된 job은 proof를 재생성하지 않는다.
    const existing = await transactionRepository.findContentRegistrationByJobId(message.jobId);
    if (existing) {
      console.log(`[${this.workerId}] already processed, skip jobId=${message.jobId}`);
      return;
    }

    //grpc get job data
    console.log(`[${this.workerId}] fetching data via gRPC`);
    const source = await getContentRegistrationSource(message.registrationId, message.jobId);

    // generate proof
    console.log(`[${this.workerId}] proof generation started`);
    const proof = await createContentRegistrationProof({
      jobId: message.jobId,
      registrationId: message.registrationId,
      originalText: source.originalText,
      authorPkOwn: source.authorPkOwn
    });

    if (!proof.success) {
      await this.sendFailed(message,new Error(proof.reason));
      console.log(`[${this.workerId}] proof generation failed`);
      return;
    }
    console.log(`[${this.workerId}] proof generation completed`);

    // Proof 결과 DB 저장 (jobId unique constraint로 race condition 방지)
    try {
      await saveContentRegistrationTransaction({
        jobId: message.jobId,
        registrationId: message.registrationId,
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
    if (message.purchaseId == null) {
      throw new Error(`purchaseId is required: jobId=${message.jobId}`);
    }

    const existing = await transactionRepository.findTradeApprovalByJobId(message.jobId);
    if (existing) {
      console.log(`[${this.workerId}] already processed, skip jobId=${message.jobId}`);
      return;
    }

    console.log(`[${this.workerId}] proof generation started`);
    const proof = await generateProof({
      proofType: "TRADE_APPROVAL",
      purchaseId: message.purchaseId,
    });
    if (!proof.success) {
      await this.sendFailed(message,new Error(proof.reason));
      console.log(`[${this.workerId}] proof generation failed`);
      return;
    }
    console.log(`[${this.workerId}] proof generation completed`);

    try {
      await transactionRepository.createTradeApproval({
        jobId: message.jobId,
        purchaseId: message.purchaseId,
        proof:proof.result.proof,
        publicSignals: proof.result.publicSignals,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        console.log(`[${this.workerId}] already created by another worker, skip jobId=${message.jobId}`);
        return;
      }
      throw error;
    }

    await sendBlockchainTransaction({
      type: "BLOCKCHAIN_TRANSACTION",
      jobId: message.jobId,
      jobType: "TRADE_APPROVAL",
    });
    console.log(`[${this.workerId}] published BLOCKCHAIN_TRANSACTION jobId=${message.jobId}`);
  }

  private async sendFailed(message: ProofRequestedMessage, error: unknown): Promise<void> {
    const reason = error instanceof Error ? error.message : String(error);

    const failed: JobFailedMessage =
      message.proofType === "CONTENT_REGISTRATION"
        ? {
          jobId: message.jobId,
          requestedAt: message.requestedAt,
          failedStage: "PROOF",
          reason,
          proofType: "CONTENT_REGISTRATION",
          registrationId: message.registrationId ?? 0,
        }
        : {
          jobId: message.jobId,
          requestedAt: message.requestedAt,
          failedStage: "PROOF",
          reason,
          proofType: "TRADE_APPROVAL",
          purchaseId: message.purchaseId ?? 0,
        };

    console.log(`[${this.workerId}] sending PROOF_FAILED`);
    await sendProofFailed(failed);
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
