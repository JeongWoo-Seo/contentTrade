import { env } from "../config/env.js";
import { GROUPS, STREAMS, runStreamConsumer } from "../redis/streams.js";
import { processReceiptCheck } from "../services/receipt.service.js";

/**
 * Receipt Worker.
 * `blockchain:receipt` Stream의 RECEIPT_CHECK_REQUESTED 이벤트를 소비하여
 * receipt 확인 후 CONFIRMED(+outbox) 또는 FAILED(타임아웃)로 전이한다.
 */
export class ReceiptWorker {
  private running = false;
  private readonly consumer = `receipt-${process.pid}`;

  async start(): Promise<void> {
    this.running = true;
    console.log(`[blockchain-worker] receipt worker started (consumer=${this.consumer})`);

    await runStreamConsumer({
      stream: STREAMS.receipt,
      group: GROUPS.receipt,
      consumer: this.consumer,
      blockMs: env.redisBlockTimeoutMs,
      reclaimIntervalMs: env.redisReclaimIntervalMs,
      process: (message) => processReceiptCheck(message.jobId, message.jobType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] receipt worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
