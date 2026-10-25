import { checkContentRegistrationReceipt, checkTradeApprovalReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { transactionRepository } from "../repositories/transation.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { withDbRetry } from "../utils/retry.js";
import type {
  ContentRegistrationTransaction,
  TradeApprovalTransaction,
  OutboxJobType,
} from "@prisma/client";
import type { ReceiptCheckResult } from "../blockchain/type.js";

export async function processReceiptCheck(
  jobId: string,
  jobType: OutboxJobType,
): Promise<void> {
  if (jobType === "CONTENT_REGISTRATION") {
    await processContentRegistrationReceipt(jobId);
  } else {
    await processTradeApprovalReceipt(jobId);
  }
}

async function processContentRegistrationReceipt(
  jobId: string,
): Promise<void> {
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const receipt = await checkContentRegistrationReceipt(job.txHash!);

  // 아직 블록에 포함되지 않음 → Outbox를 PENDING으로 되돌려 재발행
  if (!receipt.confirmed && !receipt.failed) {
    await markReceiptCheckPendingWithRetry(job.jobId);
    console.error(
      `[receipt-worker] content registration not yet ` +
      `jobId=${job.jobId} ` +
      `txHash=${receipt.transactionHash}`,
    );
    return;
  }

  // 블록체인 실행 실패
  if (receipt.failed) {
    await failContentRegistrationWithRetry(job, receipt);

    console.error(
      `[receipt-worker] content registration FAILED ` +
      `jobId=${job.jobId} ` +
      `txHash=${receipt.transactionHash}`,
    );

    return;
  }

  // 블록체인 실행 성공
  await confirmContentRegistrationWithRetry(job);

  console.log(
    `[receipt-worker] content registration CONFIRMED ` +
    `jobId=${job.jobId}`,
  );
}

async function processTradeApprovalReceipt(jobId: string): Promise<void> {
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const receipt = await checkTradeApprovalReceipt(job.txHash!);

  if (!receipt.confirmed && !receipt.failed) {
    await markReceiptCheckPendingWithRetry(job.jobId);
    return;
  }

  if (receipt.failed) {
    await failTradeApprovalWithRetry(job, receipt);

    console.error(
      `[receipt-worker] trade approval FAILED ` +
      `jobId=${job.jobId} ` +
      `txHash=${receipt.transactionHash}`,
    );

    return;
  }

  await confirmTradeApprovalWithRetry(job);

  console.log(
    `[receipt-worker] trade approval CONFIRMED ` +
    `jobId=${job.jobId}`,
  );
}

/**
 * Receipt 미확정 시 해당 job의 RECEIPT_CHECK_REQUESTED Outbox를 PENDING으로 되돌린다.
 * Outbox worker가 확인 메시지를 재발행한다. DB 반영 실패 시 throw하여
 * Kafka consumer가 offset을 commit하지 않도록 한다.
 */
async function markReceiptCheckPendingWithRetry(jobId: string): Promise<void> {
  await withDbRetry(
    () => outboxRepository.markPendingForReceiptRetry(jobId),
    { operationName: `markReceiptCheckPending:${jobId}` },
  );
}

async function failContentRegistrationWithRetry(
  job: ContentRegistrationTransaction,
  receipt: ReceiptCheckResult,
): Promise<boolean> {
  const failureReason = `Transaction reverted (status=${receipt.status})`;

  return withDbRetry(
    () => transactionRepository.failContentRegistration(job, failureReason),
    {
      operationName: `failContentRegistration:${job.jobId}`,
    },
  );
}

async function failTradeApprovalWithRetry(
  job: TradeApprovalTransaction,
  receipt: ReceiptCheckResult,
): Promise<boolean> {
  const failureReason = `Transaction reverted (status=${receipt.status})`;

  return withDbRetry(
    () => transactionRepository.failTradeApproval(job, failureReason),
    {
      operationName: `failTradeApproval:${job.jobId}`,
    },
  );
}

async function confirmContentRegistrationWithRetry(
  job: ContentRegistrationTransaction,
): Promise<boolean> {
  return withDbRetry(
    () => transactionRepository.confirmContentRegistration(job),
    {
      operationName: `confirmContentRegistration:${job.jobId}`,
    },
  );
}

async function confirmTradeApprovalWithRetry(
  job: TradeApprovalTransaction,
): Promise<boolean> {
  return withDbRetry(
    () => transactionRepository.confirmTradeApproval(job),
    {
      operationName: `confirmTradeApproval:${job.jobId}`,
    },
  );
}
