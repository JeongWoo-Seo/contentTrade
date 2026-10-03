import "dotenv/config";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { startProducer, disconnectProducer } from "./kafka/producer.js";
import { connectProofFailedConsumer, disconnectProofFailedConsumer } from "./kafka/consumer.js";
import { startGrpcServer } from "./grpc/grpc.server.js";
import { OutboxWorker } from "./workers/outbox.worker.js";

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    // db
    await prisma.$connect();
    console.log("PostgreSQL connected");

    // kafka producer (Outbox Worker가 PROOF_REQUESTED publish)
    await startProducer();

    // kafka consumer (PROOF_FAILED 처리)
    connectProofFailedConsumer().catch((error) => {
      console.error("Kafka consumer failed:", error);
      process.exit(1);
    });

    // grpc
    startGrpcServer();

    // Outbox Worker
    const outboxWorker = new OutboxWorker();
    outboxWorker.start().catch((error) => {
      console.error("outbox worker crashed:", error);
    });

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // graceful shutdown
    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      console.log(`Received ${signal}, shutting down...`);
      try {
        outboxWorker.stop();
        await disconnectProducer();
        await disconnectProofFailedConsumer();
        await prisma.$disconnect();

        server.close(() => process.exit(0));
      } catch (error) {
        console.error("shutdown failed:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("server failed:", error);
    process.exit(1);
  }
}

startServer();
