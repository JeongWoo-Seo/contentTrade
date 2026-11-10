import { outboxRepository } from "../repositories/outbox.repository.js";
import { sendMessage, sendBlockchainFailed, sendAccountRegistrationResult, sendAccountRegistrationRetry, sendPurchaseVerificationRetry, sendPurchaseVerificationResult } from "../kafka/producer.js";
import { topicForEventType } from "../kafka/topics.js";
import type { TransactionOutbox } from "@prisma/client";
import type { JobFailedMessage, AccountResultMessage, AccountRegistrationRequestMessage, PurchaseRequestMessage, PurchaseResultMessage } from "../kafka/types.js";
import { withDbRetry } from "../utils/retry.js";
import { transactionRepository } from "../repositories/transation.repository.js";
import { accountRegistrationRepository } from "../repositories/account-registration.repository.js";
import { jobFailureRepository } from "../repositories/jobFailure.repository.js";
import { purchaseVerificationRepository } from "../repositories/purchase-verification.repository.js";

export async function publishNextPendingOutbox(): Promise<void> {
  const outbox = await outboxRepository.findNextPending();

  if (!outbox) {
    return;
  }

  try {
    await processOutbox(outbox);

    console.log(
      `[outbox-worker] ` +
      `outbox processed ` +
      `id=${outbox.id} ` +
      `jobId=${outbox.jobId} ` +
      `eventType=${outbox.eventType}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await outboxRepository.markPublishFailed(outbox.id, message);

    console.error(
      `[outbox-worker] ` +
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
  switch (outbox.jobType) {
    case "ACCOUNT_REGISTRATION":
      if (outbox.eventType === "RECEIPT_CHECK_REQUESTED") {
        await processAccountRegistrationRetry(outbox)
      } else {
        await processAccountRegistrationResult(outbox)
      }
      return;

    case "PURCHASE_VERIFICATION":
      if (outbox.eventType === "RECEIPT_CHECK_REQUESTED") {
        await processPurchaseVerificationRetry(outbox);
      } else {
        await processPurchaseVerificationResult(outbox);
      }
      return;

    default:
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
}

///////////////////////////////////////////
//        AccountRegistration
///////////////////////////////////////////

async function processAccountRegistrationResult(outbox: TransactionOutbox)
  : Promise<void> {
  await publishAccountResult(outbox)

  await markOutboxPublishedWithRetry(outbox.id)
}

async function processAccountRegistrationRetry(
  outbox: TransactionOutbox,
): Promise<void> {
  await publishAccountRegistrationRetry(outbox);

  await markOutboxPublishedWithRetry(outbox.id);
}

async function publishAccountResult(
  outbox: TransactionOutbox,
): Promise<void> {
  try {
    const registration = await accountRegistrationRepository.findByJobId(outbox.jobId);
    if (!registration) {
      return;
    }

    let message: AccountResultMessage;

    if (registration.status === "CONFIRMED") {
      message = {
        jobId: registration.jobId,
        jobType: "ACCOUNT_REGISTRATION",
        eventType: topicForEventType(outbox.eventType),
        result: "ACTIVE",
        referenceId: registration.userId,
      };
    } else if (registration.status === "FAILED") {
      const failure = await jobFailureRepository.findLatestFailureByJobId(outbox.jobId);

      if (!failure) {
        return;
      }

      message = {
        jobId: registration.jobId,
        jobType: "ACCOUNT_REGISTRATION",
        eventType: topicForEventType(outbox.eventType),
        result: "REJECTED",
        referenceId: registration.userId,
        reason: failure.failureReason,
      };
    } else {
      throw new Error(
        `Invalid account registration result status: ` +
        `jobId=${outbox.jobId}, status=${registration.status}`,
      );
    }

    await sendAccountRegistrationResult(message);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] account result publish failed ` +
      `outboxId=${outbox.id} ` +
      `jobId=${outbox.jobId} ` +
      `reason=${reason}`,
    );

    throw error;
  }
}

async function publishAccountRegistrationRetry(
  outbox: TransactionOutbox,
): Promise<void> {
  try {
    const registration = await accountRegistrationRepository.findByJobId(outbox.jobId);

    if (!registration) {
      throw new Error(`Account registration not found: jobId=${outbox.jobId}`);
    }

    const message = {
      jobId: registration.jobId,
      jobType: "ACCOUNT_REGISTRATION" as const,
      eventType: topicForEventType(outbox.eventType),
      addr: registration.addr,
      txHash: registration.txHash,
      referenceId: registration.userId,
    } as AccountRegistrationRequestMessage;

    await sendAccountRegistrationRetry(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] ` +
      `account result try publish failed ` +
      `outboxId=${outbox.id} ` +
      `jobId=${outbox.jobId} `
    );

    throw error;
  }
}

async function processPurchaseVerificationRetry(
  outbox: TransactionOutbox,
): Promise<void> {
  await publishPurchaseVerificationRetry(outbox);

  await markOutboxPublishedWithRetry(outbox.id);
}

async function publishPurchaseVerificationRetry(
  outbox: TransactionOutbox,
): Promise<void> {
  try {
    const verification = await purchaseVerificationRepository.findByJobId(outbox.jobId);

    if (!verification) {
      throw new Error(`Purchase verification not found: jobId=${outbox.jobId}`);
    }

    const message: PurchaseRequestMessage = {
      jobId: verification.jobId,
      jobType: "PURCHASE_VERIFICATION",
      txHash: verification.txHash,
      referenceId: verification.referenceId,
    };

    await sendPurchaseVerificationRetry(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] purchase verification retry publish failed ` +
      `outboxId=${outbox.id} jobId=${outbox.jobId}: ${reason}`,
    );

    throw error;
  }
}

async function processPurchaseVerificationResult(
  outbox: TransactionOutbox,
): Promise<void> {
  await publishPurchaseResult(outbox);

  await markOutboxPublishedWithRetry(outbox.id);
}

async function publishPurchaseResult(
  outbox: TransactionOutbox,
): Promise<void> {
  try {
    const verification = await purchaseVerificationRepository.findByJobId(outbox.jobId);
    if (!verification) {
      return;
    }

    let message: PurchaseResultMessage;

    if (verification.status === "CONFIRMED") {
      message = {
        jobId: verification.jobId,
        jobType: "PURCHASE_VERIFICATION",
        eventType: topicForEventType(outbox.eventType),
        result: "APPROVING",
        referenceId: verification.referenceId,
      };
    } else if (verification.status === "FAILED") {
      const failure = await jobFailureRepository.findLatestFailureByJobId(outbox.jobId);

      if (!failure) {
        return;
      }

      message = {
        jobId: verification.jobId,
        jobType: "PURCHASE_VERIFICATION",
        eventType: topicForEventType(outbox.eventType),
        result: "REJECTED",
        referenceId: verification.referenceId,
        reason: failure.failureReason,
      };
    } else {
      throw new Error(
        `Invalid purchase verification result status: ` +
        `jobId=${outbox.jobId}, status=${verification.status}`,
      );
    }

    await sendPurchaseVerificationResult(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] purchase result publish failed ` +
      `outboxId=${outbox.id} jobId=${outbox.jobId}: ${reason}`,
    );

    throw error;
  }
}

async function processTransactionFailed(
  outbox: TransactionOutbox,
): Promise<void> {
  // Kafka 전송
  await publishFailure(outbox);

  // Kafka 전송 성공 후 DB 작업 (트랜잭션 삭제 + outbox PUBLISHED)
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
  const message = await buildJobFailedMessage(outbox);
  try {
    await sendBlockchainFailed(message);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] ` +
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
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.error(
      `[outbox-worker] ` +
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

async function buildJobFailedMessage(
  outbox: TransactionOutbox,
): Promise<JobFailedMessage> {
  const failedStage = getFailedStage(outbox.eventType);
  const requestedAt = outbox.createdAt.toISOString();

  if (
    outbox.jobType !== "CONTENT_REGISTRATION" &&
    outbox.jobType !== "TRADE_APPROVAL"
  ) {
    throw new Error(
      `Unsupported outbox job type: ${outbox.jobType}`,
    );
  }

  const failure = await jobFailureRepository.findLatestFailureByJobId(outbox.jobId);
  if (!failure) {
    throw new Error(
      `Job failure record not found: ` +
      `jobId=${outbox.jobId}, jobType=${outbox.jobType}`,
    );
  }

  const reason = failure.failureReason;

  if (outbox.jobType === "CONTENT_REGISTRATION") {
    return {
      jobId: outbox.jobId,
      requestedAt,
      failedStage,
      reason,
      jobType: "CONTENT_REGISTRATION",
      referenceId: failure.referenceId,
    };
  }

  return {
    jobId: outbox.jobId,
    requestedAt,
    failedStage,
    reason,
    jobType: "TRADE_APPROVAL",
    referenceId: failure.referenceId,
  };
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
