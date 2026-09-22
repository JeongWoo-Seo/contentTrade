import { CONSUMER_GROUPS, TOPICS } from "../kafka/topics.js";
import { startConsumer } from "../kafka/consumer.js";
import { processContentRegistration } from "../services/transaction/contentResistration.service.js";
import { processTradeApproval } from "../services/transaction/tradeApproval.service.js";
import type { OutboxJobType } from "@prisma/client";

/**
 * Transaction Worker.
 * `blockchain.transaction` topic의 TRANSACTION_REQUESTED 이벤트를 소비하여
 * EVM 전송 후 SUBMITTED(+outbox) 또는 FAILED(+outbox)로 전이한다.
 */
export class TransactionWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] transaction worker started");

    await startConsumer({
      topic: TOPICS.transaction,
      groupId: CONSUMER_GROUPS.transaction,
      process: (message) => processTransactionRequest(message.jobId, message.jobType),
      shouldRun: () => this.running,
    });

    console.log("[blockchain-worker] transaction worker stopped");
  }

  stop(): void {
    this.running = false;
  }
}

async function processTransactionRequest(
  jobId: string,
  jobType: OutboxJobType,
): Promise<void> {
  if (jobType === "CONTENT_REGISTRATION") {
    await processContentRegistration(jobId);
  } else {
    await processTradeApproval(jobId);
  }
}
