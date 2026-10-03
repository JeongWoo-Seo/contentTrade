import { publishNextPendingOutbox } from "../services/outbox.service.js";
import { env } from "../config/env.js";

/**
 * Outbox Worker.
 * PENDING Outbox를 조회하여 Kafka(PROOF_REQUESTED)에 publish하고 PUBLISHED로 전이한다.
 * 단일 인스턴스로 실행한다.
 */
export class OutboxWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[market-server] outbox worker started");

    while (this.running) {
      try {
        await publishNextPendingOutbox();
      } catch (error) {
        console.error("[market-server] outbox worker error:", error);
      }
      await this.sleep();
    }

    console.log("[market-server] outbox worker stopped");
  }

  stop(): void {
    this.running = false;
  }

  private sleep(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, env.outboxWorkerIntervalMs));
  }
}
