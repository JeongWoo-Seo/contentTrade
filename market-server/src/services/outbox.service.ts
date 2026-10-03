import { outboxRepository } from "../repositories/outbox.repository.js";
import { sendProofRequested } from "../kafka/producer.js";
import { withDbRetry } from "../utils/retry.js";
import type { Outbox } from "@prisma/client";
import type { MarketKafkaMessage } from "../kafka/types.js";

/**
 * PENDING Outbox 하나를 Kafka(PROOF_REQUESTED)로 publish하고 PUBLISHED 처리한다.
 * publish 실패 시 retryCount 증가 + lastError 기록 후 PENDING으로 유지한다.
 */
export async function publishNextPendingOutbox(): Promise<boolean> {
  const outbox = await outboxRepository.findNextPending();
  if (!outbox) {
    return false;
  }

  try {
    // Kafka publish (실패 시 throw → 아래 catch에서 markPublishFailed)
    await sendProofRequested(buildProofRequestedMessage(outbox));

    await withDbRetry(
      () => outboxRepository.markPublished(outbox.id),
      { operationName: `markPublished:${outbox.id}` },
    );

    console.log(`[market-server] outbox published id=${outbox.id} jobId=${outbox.jobId}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await withDbRetry(
      () => outboxRepository.markPublishFailed(outbox.id, message),
      { operationName: `markPublishFailed:${outbox.id}` },
    );

    console.error(`[market-server] outbox publish failed id=${outbox.id} jobId=${outbox.jobId}: ${message}`);
    return false;
  }
}

function buildProofRequestedMessage(outbox: Outbox): MarketKafkaMessage {
  if (outbox.jobType === "CONTENT_REGISTRATION") {
    return {
      jobId: outbox.jobId,
      proofType: "CONTENT_REGISTRATION",
      registrationId: outbox.referenceId,
      requestedAt: outbox.createdAt.toISOString(),
    };
  }

  return {
    jobId: outbox.jobId,
    proofType: "TRADE_APPROVAL",
    purchaseId: outbox.referenceId,
    requestedAt: outbox.createdAt.toISOString(),
  };
}
