import { outboxRepository } from "../repositories/outbox.repository.js";
import { publishEvent } from "../redis/streams.js";

/**
 * PENDING Outbox 하나를 Redis에 publish하고 PUBLISHED 처리한다.
 * publish 실패 시 retryCount 증가 + lastError 기록 후 PENDING으로 유지한다.
 */
export async function publishNextPendingOutbox(): Promise<boolean> {
  const outbox = await outboxRepository.findNextPending();
  if (!outbox) {
    return false;
  }

  try {
    await publishEvent(outbox.eventType, {
      jobId: outbox.jobId,
      jobType: outbox.jobType,
    });
    await outboxRepository.markPublished(outbox.id);
    console.log(`[blockchain-worker] outbox published id=${outbox.id} jobId=${outbox.jobId} eventType=${outbox.eventType}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await outboxRepository.markPublishFailed(outbox.id, message);
    console.error(
      `[blockchain-worker] outbox publish failed id=${outbox.id} jobId=${outbox.jobId}: ${message}`,
    );
    return false;
  }
}
