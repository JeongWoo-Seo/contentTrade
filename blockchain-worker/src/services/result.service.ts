import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { completeContentRegistration, completeTradeApproval } from "../grpc/market.client.js";
import { Market } from "@content-trade/grpc-contract";
import type { OutboxEventType, OutboxJobType } from "@prisma/client";
import { withDbRetry, withGrpcRetry } from "../utils/retry.js";

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
    await processContentRegistrationResult(jobId);
  } else {
    await processTradeApprovalResult(jobId);
  }
}

async function processContentRegistrationResult(
  jobId: string,
): Promise<void> {
  // --------------------------------------------------
  // Blockchain 단계 결과
  // --------------------------------------------------
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);

  if (!job) {
    // 이미 전송 완료되어 삭제된 Job
    return;
  }

  // --------------------------------------------------
  // Blockchain TX 성공
  // --------------------------------------------------
  if (job.status !== "CONFIRMED") {
    return;
  }

  const request: Market.CompleteContentRegistrationRequest = {
    jobId: job.jobId,
    registrationId: job.registrationId,

    encryptedData: job.encryptedData,
    hK: job.hK,
    hData: job.hData,
    hCt: job.hCt,

    txHash: job.txHash ?? "",
  };

  await completeContentRegistrationWithRetry(request);

  await deleteContentRegistrationTransactionWithRetry(job.jobId, job.id);

  console.log(`[result-send-worker] content registration result sent jobId=${job.jobId}`);
}

async function processTradeApprovalResult(
  jobId: string,
): Promise<void> {
  // --------------------------------------------------
  // Blockchain 단계 결과
  // --------------------------------------------------
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);

  if (!job) {
    // 이미 전송 완료되어 삭제된 Job
    return;
  }

  // --------------------------------------------------
  // Blockchain TX 성공
  // --------------------------------------------------
  if (job.status !== "CONFIRMED") {
    return;
  }

  const request: Market.CompleteTradeApprovalRequest = {
    jobId: job.jobId,
    tradeId: job.purchaseId,
    txHash: job.txHash ?? "",
  };

  await completeTradeApprovalWithRetry(request);

  await deleteTradeApprovalTransactionWithRetry(job.jobId, job.id);

  console.log(`[result-send-worker] trade approval result sent jobId=${job.jobId}`);
}

async function deleteContentRegistrationTransactionWithRetry(
  jobId: string,
  id: number,
): Promise<void> {
  await withDbRetry(
    () => contentRegistrationTransactionRepository.delete(id),
    {
      operationName: `deleteContentRegistrationTransaction:${jobId}`,
    },
  );
}

async function deleteTradeApprovalTransactionWithRetry(
  jobId: string,
  id: number,
): Promise<void> {
  await withDbRetry(
    () =>
      tradeApprovalTransactionRepository.delete(id),
    {
      operationName:
        `deleteTradeApprovalTransaction:${jobId}`,
    },
  );
}

async function completeContentRegistrationWithRetry(
  request: Market.CompleteContentRegistrationRequest,
): Promise<Market.CompleteContentRegistrationResponse> {
  return withGrpcRetry(
    () => completeContentRegistration(request),
    {
      operationName:
        `completeContentRegistration:${request.jobId}`,
    },
  );
}

export async function completeTradeApprovalWithRetry(
  request: Market.CompleteTradeApprovalRequest,
): Promise<Market.CompleteTradeApprovalResponse> {
  return withGrpcRetry(
    () => completeTradeApproval(request),
    {
      operationName:
        `completeTradeApproval:${request.jobId}`,
    },
  );
}