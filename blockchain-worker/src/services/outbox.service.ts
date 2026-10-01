import { outboxRepository } from "../repositories/outbox.repository.js";
import { sendMessage, sendBlockchainFailed } from "../kafka/producer.js";
import { topicForEventType } from "../kafka/topics.js";
import type { TransactionOutbox } from "@prisma/client";
import type { JobFailedMessage } from "../kafka/types.js";
import { withDbRetry } from "../utils/retry.js";
import { transactionRepository } from "../repositories/transation.repository.js";

const FAILURE_EVENT_TYPES = new Set([
  "TRANSACTION_FAILED",
  "PROOF_FAILED",
]);

export async function publishNextPendingOutbox(): Promise<void> {
  const outbox = await outboxRepository.findNextPending();

  if (!outbox) {
    return;
  }

  try {
    await processOutbox(outbox);

    console.log(
      `[blockchain-worker] ` +
      `outbox processed ` +
      `id=${outbox.id} ` +
      `jobId=${outbox.jobId} ` +
      `eventType=${outbox.eventType}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await outboxRepository.markPublishFailed(outbox.id, message);

    console.error(
      `[blockchain-worker] ` +
      `outbox processing failed ` +
      `id=${outbox.id} ` +
      `jobId=${outbox.jobId} ` +
      `eventType=${outbox.eventType}: ${message}`,
    );
  }
}

async function processOutbox(
  outbox: TransactionOutbox,
): Promise<void> {
  switch (outbox.eventType) {
    case "TRANSACTION_FAILED":
      await processTransactionFailed(outbox);
      return;

    case "PROOF_FAILED":
      await processProofFailed(outbox);
      return;

    default:
      await processNormalEvent(outbox);
      return;
  }
}

async function processTransactionFailed(
  outbox: TransactionOutbox,
): Promise<void> {
  // Kafka 전송
  await publishFailure(outbox);

  // Kafka 전송 성공 후 DB 작업
  await markTransactionFailedProcessedWithRetry(outbox);
}

async function processProofFailed(
  outbox: TransactionOutbox,
): Promise<void> {
  // 1. 실패 메시지 Kafka 전송
  await publishFailure(outbox);

  // 2. outbox published 처리
  await markOutboxPublishedWithRetry(outbox.id);
}

async function processNormalEvent(
  outbox: TransactionOutbox,
): Promise<void> {
  // 1. Kafka 전송
  await publishToNextWorker(outbox);

  // 2. outbox published 처리
  await markOutboxPublishedWithRetry(outbox.id);
}

async function publishFailure(
  outbox: TransactionOutbox,
): Promise<void> {
  const message = buildJobFailedMessage(outbox);
  try {
    await sendBlockchainFailed(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[blockchain-worker] ` +
        `failure message publish failed ` +
        `outboxId=${outbox.id} ` +
        `jobId=${outbox.jobId} ` +
        `eventType=${outbox.eventType} ` +
        `jobType=${outbox.jobType} ` +
        `reason=${reason}`,
    );

    throw error;
  }
}

async function publishToNextWorker(
  outbox: TransactionOutbox,
): Promise<void> {
  try {
    await sendMessage(
      topicForEventType(outbox.eventType),
      outbox.jobId,
      {
        jobId: outbox.jobId,
        jobType: outbox.jobType,
        eventType: outbox.eventType,
      }
  )} catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[blockchain-worker] ` +
        `next worker message publish failed ` +
        `outboxId=${outbox.id} ` +
        `jobId=${outbox.jobId} ` +
        `eventType=${outbox.eventType} ` +
        `jobType=${outbox.jobType} ` +
        `reason=${reason}`,
    );

    throw error;
  }
}

async function markTransactionFailedProcessedWithRetry(
  outbox: TransactionOutbox,
): Promise<void> {
  await withDbRetry(
    () => transactionRepository.markTransactionFailedProcessed(outbox),
    {
      operationName: `markTransactionFailedProcessed:${outbox.jobId}`,
    },
  );
}

async function markOutboxPublishedWithRetry(
  outboxId: number,
): Promise<void> {
  await withDbRetry(
    () => outboxRepository.markPublished(outboxId),
    {
      operationName: `markOutboxPublished:${outboxId}`,
    },
  );
}

function buildJobFailedMessage(
  outbox: TransactionOutbox,
): JobFailedMessage {
  const failedStage = getFailedStage(outbox.eventType);

  const requestedAt = (outbox.createdAt).toISOString();

  const reason = outbox.failReason ?? "job failed";

  if (outbox.jobType === "CONTENT_REGISTRATION") {
    if (outbox.registrationId == null) {
      throw new Error(
        `registrationId is required: ` +
          `outboxId=${outbox.id} ` +
          `jobId=${outbox.jobId}`,
      );
    }

    return {
      jobId: outbox.jobId,
      requestedAt,
      failedStage,
      reason,
      proofType: "CONTENT_REGISTRATION",
      registrationId: outbox.registrationId,
    };
  }

  if (outbox.jobType === "TRADE_APPROVAL") {
    if (outbox.purchaseId == null) {
      throw new Error(
        `purchaseId is required: ` +
          `outboxId=${outbox.id} ` +
          `jobId=${outbox.jobId}`,
      );
    }

    return {
      jobId: outbox.jobId,
      requestedAt,
      failedStage,
      reason,
      proofType: "TRADE_APPROVAL",
      purchaseId: outbox.purchaseId,
    };
  }

  throw new Error(`Unsupported outbox job type: ${outbox.jobType}`);
}

function getFailedStage(
  eventType: TransactionOutbox["eventType"],
): "PROOF" | "BLOCKCHAIN" {
  switch (eventType) {
    case "PROOF_FAILED":
      return "PROOF";

    case "TRANSACTION_FAILED":
      return "BLOCKCHAIN";

    default:
      throw new Error(`Invalid failure event type: ${eventType}`);
  }
}