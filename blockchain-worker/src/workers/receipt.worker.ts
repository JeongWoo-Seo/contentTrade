import { CONSUMER_GROUPS, TOPICS } from "../kafka/topics.js";
import { startConsumer } from "../kafka/consumer.js";
import { processReceiptCheck } from "../services/receipt.service.js";

/**
 * Receipt Worker.
 * `blockchain.receipt` topic의 RECEIPT_CHECK_REQUESTED 이벤트를 소비하여
 * receipt 확인 후 CONFIRMED(+outbox) 또는 FAILED(타임아웃)로 전이한다.
 */
export class ReceiptWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] receipt worker started");

    await startConsumer({
      topic: TOPICS.receipt,
      groupId: CONSUMER_GROUPS.receipt,
      process: (message) => processReceiptCheck(message.jobId, message.jobType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] receipt worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
