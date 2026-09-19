import { env } from "../config/env.js";
import { GROUPS, STREAMS, runStreamConsumer } from "../redis/streams.js";
import { processTransactionRequest } from "../services/transaction/transaction.service.js";

/**
 * Transaction Worker.
 * `blockchain:transaction` Stream의 TRANSACTION_REQUESTED 이벤트를 소비하여
 * EVM 전송 후 SUBMITTED(+outbox) 또는 FAILED(+outbox)로 전이한다.
 */
export class TransactionWorker {
  private running = false;
  private readonly consumer = `transaction-${process.pid}`;

  async start(): Promise<void> {
    this.running = true;
    console.log(`[blockchain-worker] transaction worker started (consumer=${this.consumer})`);

    await runStreamConsumer({
      stream: STREAMS.transaction,
      group: GROUPS.transaction,
      consumer: this.consumer,
      blockMs: env.redisBlockTimeoutMs,
      reclaimIntervalMs: env.redisReclaimIntervalMs,
      process: (message) => processTransactionRequest(message.jobId, message.jobType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] transaction worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
