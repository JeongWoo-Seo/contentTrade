import { checkContentRegistrationReceipt, checkTradeApprovalReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { transactionRepository } from "../repositories/transation.repository.js";
import { sendMessage } from "../kafka/producer.js";
import { TOPICS } from "../kafka/topics.js";
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

  // 아직 블록에 포함되지 않음 → Receipt Kafka 재발행
  if (!receipt.confirmed && !receipt.failed) {
    await publishReceiptCheckRetry({
      jobId: job.jobId,
      jobType: "CONTENT_REGISTRATION",
    });
    return;
  }

  // 블록체인 실행 실패
  if (receipt.failed) {
    await failContentRegistrationWithRetry(job, receipt);

    console.error(
      `[blockchain-worker] content registration FAILED ` +
      `jobId=${job.jobId} ` +
      `txHash=${receipt.transactionHash}`,
    );

    return;
  }

  // 블록체인 실행 성공
  await confirmContentRegistrationWithRetry(job);

  console.log(
    `[blockchain-worker] content registration CONFIRMED ` +
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
    await publishReceiptCheckRetry({
      jobId: job.jobId,
      jobType: "TRADE_APPROVAL",
    });
    return;
  }

  if (receipt.failed) {
    await failTradeApprovalWithRetry(job, receipt);

    console.error(
      `[blockchain-worker] trade approval FAILED ` +
      `jobId=${job.jobId} ` +
      `txHash=${receipt.transactionHash}`,
    );

    return;
  }

  await confirmTradeApprovalWithRetry(job);

  console.log(
    `[blockchain-worker] trade approval CONFIRMED ` +
    `jobId=${job.jobId}`,
  );
}

/**
 * pending receipt를 Receipt Kafka topic에 재발행한다.
 * publish 실패 시 반드시 throw하여 Kafka consumer가 offset을 commit하지 않도록 한다.
 */
async function publishReceiptCheckRetry(
  message: {
    jobId: string;
    jobType: OutboxJobType;
  },
): Promise<void> {
  try {
    await sendMessage(TOPICS.receipt, message.jobId, {
      jobId: message.jobId,
      jobType: message.jobType,
    });

    console.log(
      `[blockchain-worker] ` +
      `receipt check retry published ` +
      `jobId=${message.jobId} ` +
      `jobType=${message.jobType} ` +
      `topic=${TOPICS.receipt}`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[blockchain-worker] ` +
      `receipt check retry publish failed ` +
      `jobId=${message.jobId} ` +
      `jobType=${message.jobType} ` +
      `topic=${TOPICS.receipt} ` +
      `reason=${reason}`,
    );

    // 반드시 throw → Kafka consumer가 현재 offset을 commit하지 않음
    throw error;
  }
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
