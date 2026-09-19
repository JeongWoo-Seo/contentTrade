import { env } from "../config/env.js";
import { GROUPS, STREAMS, runStreamConsumer } from "../redis/streams.js";
import { processResult } from "../services/result.service.js";

/**
 * ResultSend Worker.
 * `blockchain:result` Stream의 TRANSACTION_COMPLETED / TRANSACTION_FAILED 이벤트를 소비하여
 * 최종 성공(Market gRPC) 또는 실패(Kafka) 결과를 market-server에 전달한다.
 */
export class ResultSendWorker {
  private running = false;
  private readonly consumer = `result-${process.pid}`;

  async start(): Promise<void> {
    this.running = true;
    console.log(`[blockchain-worker] result send worker started (consumer=${this.consumer})`);

    await runStreamConsumer({
      stream: STREAMS.result,
      group: GROUPS.result,
      consumer: this.consumer,
      blockMs: env.redisBlockTimeoutMs,
      reclaimIntervalMs: env.redisReclaimIntervalMs,
      process: (message) => processResult(message.jobId, message.jobType, message.eventType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] result send worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
