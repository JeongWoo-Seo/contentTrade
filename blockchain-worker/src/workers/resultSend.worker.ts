import { CONSUMER_GROUPS, TOPICS } from "../kafka/topics.js";
import { startConsumer } from "../kafka/consumer.js";
import { processResult } from "../services/result.service.js";

/**
 * ResultSend Worker.
 * `blockchain.result` topic의 TRANSACTION_COMPLETED / TRANSACTION_FAILED 이벤트를 소비하여
 * 최종 성공(Market gRPC) 또는 실패(Kafka) 결과를 market-server에 전달한다.
 */
export class ResultSendWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] result send worker started");

    await startConsumer({
      topic: TOPICS.result,
      groupId: CONSUMER_GROUPS.result,
      process: (message) => processResult(message.jobId, message.jobType, message.eventType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] result send worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
