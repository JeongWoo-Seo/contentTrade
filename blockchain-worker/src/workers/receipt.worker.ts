import { CONSUMER_GROUPS, TOPICS } from "../kafka/topics.js";
import { ReceiptMessage } from "../kafka/types.js";
import { startConsumer } from "../kafka/consumer.js";
import { processReceiptCheck } from "../services/receipt.service.js";

export class ReceiptWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] receipt worker started");

    await startConsumer<ReceiptMessage>({
      topic: TOPICS.receipt,
      groupId: CONSUMER_GROUPS.receipt,
      process: (message) => {
        return processReceiptCheck(message);
      },
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] receipt worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}
