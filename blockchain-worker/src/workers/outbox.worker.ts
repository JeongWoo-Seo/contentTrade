import { publishNextPendingOutbox } from "../services/outbox.service.js";
import { env } from "../config/env.js";

export class OutboxWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] outbox worker started");

    while (this.running) {
      try {
        await publishNextPendingOutbox();
      } catch (error) {
        console.error("[blockchain-worker] outbox worker error:", error);
      }
      await this.sleep();
    }

    console.log("[blockchain-worker] outbox worker stopped");
  }

  stop(): void {
    this.running = false;
  }

  private sleep(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, env.outboxWorkerIntervalMs));
  }
}
