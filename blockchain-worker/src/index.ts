import "dotenv/config";
import { connectProducer, disconnectProducer, ensureTopics } from "./kafka/producer.js";
import { TOPICS } from "./kafka/topics.js";
import { closeMarketClient } from "./grpc/market.client.js";
import { prisma } from "./lib/prisma.js";
import { OutboxWorker } from "./workers/outbox.worker.js";
import { TransactionWorker } from "./workers/transaction.worker.js";
import { ReceiptWorker } from "./workers/receipt.worker.js";
import { ResultSendWorker } from "./workers/resultSend.worker.js";
import { RecoveryWorker } from "./workers/recovery.worker.js";

async function main(): Promise<void> {
  // Kafka producer (outbox 이벤트 + 실패 메시지 발행용)
  await connectProducer();
  await ensureTopics([
    { topic: TOPICS.transaction, numPartitions: 1 },
    { topic: TOPICS.receipt, numPartitions: 1 },
    { topic: TOPICS.result, numPartitions: 1 },
  ]);

  // Workers
  const workers = [
    new OutboxWorker(),
    new TransactionWorker(),
    new ReceiptWorker(),
    new ResultSendWorker(),
    new RecoveryWorker(),
  ];

  const workerPromises = workers.map((worker) =>
    worker.start().catch((error) => {
      console.error("[blockchain-worker] worker crashed:", error);
    }),
  );

  console.log("[blockchain-worker] all workers started");

  // graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`[blockchain-worker] received ${signal}, shutting down...`);
    try {
      for (const worker of workers) {
        worker.stop();
      }

      // worker 정지 후 producer/market/prisma disconnect를 bounded wait로 시도.
      // consumer의 in-flight 메시지(장기 retry)에 막히지 않도록 force-exit으로 마무리한다.
      await Promise.race([
        (async () => {
          await disconnectProducer();
          closeMarketClient();
          await prisma.$disconnect();
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ]);

      console.log("[blockchain-worker] shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("[blockchain-worker] shutdown failed:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[blockchain-worker] failed:", error);
  process.exit(1);
});
