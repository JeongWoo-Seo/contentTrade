import "dotenv/config";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";
import { closeMarketClient } from "./grpc/market.client.js";
import { prisma } from "./lib/prisma.js";
import { connectRedis, disconnectRedis } from "./redis/client.js";
import { ensureConsumerGroups } from "./redis/streams.js";
import { OutboxWorker } from "./workers/outbox.worker.js";
import { TransactionWorker } from "./workers/transaction.worker.js";
import { ReceiptWorker } from "./workers/receipt.worker.js";
import { ResultSendWorker } from "./workers/resultSend.worker.js";
import { RecoveryWorker } from "./workers/recovery.worker.js";

async function main(): Promise<void> {
  // Redis (Streams / Consumer Group)
  await connectRedis();
  await ensureConsumerGroups();

  // Kafka producer (실패 메시지 발행용)
  await connectProducer();

  // Workers
  const workers = [
    new OutboxWorker(),
    new TransactionWorker(),
    new ReceiptWorker(),
    new ResultSendWorker(),
    new RecoveryWorker(),
  ];

  for (const worker of workers) {
    worker.start().catch((error) => {
      console.error("[blockchain-worker] worker crashed:", error);
    });
  }

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

      // Redis를 먼저 닫아 blocking XREADGROUP을 해제한다.
      await disconnectRedis();
      await disconnectProducer();//kafka
      closeMarketClient();//grpc
      await prisma.$disconnect();//db

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
