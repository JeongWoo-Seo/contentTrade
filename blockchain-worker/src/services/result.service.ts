import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { completeContentRegistration } from "../grpc/market.client.js";
import { sendBlockchainFailed } from "../kafka/producer.js";
import { Market } from "@content-trade/grpc-contract";
import type { JobFailedMessage } from "../kafka/types.js";
import type { OutboxEventType, OutboxJobType } from "@prisma/client";

/**
 * TRANSACTION_COMPLETED / TRANSACTION_FAILED 이벤트 처리.
 * 최종 결과를 market-server에 전달한다.
 *  - TRANSACTION_COMPLETED (CONFIRMED): Market gRPC 성공 전달
 *  - TRANSACTION_FAILED (FAILED): Kafka 실패 전달
 * 전달 성공 후 job을 삭제한다 (재전달 시 findByJobId가 null → idempotent skip).
 */
export async function processResult(
  jobId: string,
  jobType: OutboxJobType,
  eventType: OutboxEventType,
): Promise<void> {
  if (jobType === "CONTENT_REGISTRATION") {
    await processContentRegistrationResult(jobId, eventType);
  } else {
    await processTradeApprovalResult(jobId, eventType);
  }
}

async function processContentRegistrationResult(
  jobId: string,
  eventType: OutboxEventType,
): Promise<void> {
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);
  if (!job) return; // 이미 전송 완료(삭제됨)

  if (eventType === "TRANSACTION_COMPLETED") {
    if (job.status !== "CONFIRMED") return; // stale 이벤트
    const request: Market.CompleteContentRegistrationRequest = {
      jobId: job.jobId,
      registrationId: job.registrationId,
      encryptedData: job.encryptedData,
      dataIv: job.dataIv,
      encryptedDataKey: job.encryptedDataKey,
      keyIv: job.keyIv,
      keyAuthTag: job.keyAuthTag,
      encryptionVersion: job.encryptionVersion,
      keyHash: job.keyHash,
      encryptedDataHash: job.encryptedDataHash,
      contentHash: job.contentHash,
      txHash: job.txHash ?? "",
    };
    await completeContentRegistration(request);
    await contentRegistrationTransactionRepository.delete(job.id);
    console.log(`[blockchain-worker] content registration result sent jobId=${job.jobId}`);
    return;
  }

  if (eventType === "TRANSACTION_FAILED") {
    if (job.status !== "FAILED") return;
    await reportFailure({
      jobId: job.jobId,
      requestedAt: job.createdAt.toISOString(),
      failedStage: "BLOCKCHAIN",
      reason: job.failureReason ?? "blockchain transaction failed",
      proofType: "CONTENT_REGISTRATION",
      registrationId: job.registrationId,
    });
    await contentRegistrationTransactionRepository.delete(job.id);
    console.log(`[blockchain-worker] content registration failure sent jobId=${job.jobId}`);
    return;
  }
}

async function processTradeApprovalResult(
  jobId: string,
  eventType: OutboxEventType,
): Promise<void> {
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);
  if (!job) return;

  if (eventType === "TRANSACTION_COMPLETED") {
    if (job.status !== "CONFIRMED") return;
    // TODO: Market의 거래 승인 완료 gRPC(CompleteTradeApproval)가 추가되면 호출한다.
    await tradeApprovalTransactionRepository.delete(job.id);
    console.log(`[blockchain-worker] trade approval result sent (market TODO) jobId=${job.jobId}`);
    return;
  }

  if (eventType === "TRANSACTION_FAILED") {
    if (job.status !== "FAILED") return;
    await reportFailure({
      jobId: job.jobId,
      requestedAt: job.createdAt.toISOString(),
      failedStage: "BLOCKCHAIN",
      reason: job.failureReason ?? "blockchain transaction failed",
      proofType: "TRADE_APPROVAL",
      purchaseId: job.purchaseId,
    });
    await tradeApprovalTransactionRepository.delete(job.id);
    console.log(`[blockchain-worker] trade approval failure sent jobId=${job.jobId}`);
    return;
  }
}

async function reportFailure(message: JobFailedMessage): Promise<void> {
  await sendBlockchainFailed(message);
}
