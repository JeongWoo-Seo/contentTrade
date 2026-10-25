import "dotenv/config";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { startProducer, disconnectProducer, ensureTopics } from "./kafka/producer.js";
import { env } from "./config/env.js";
import { connectProofFailedConsumer, disconnectProofFailedConsumer, connectAccountResultConsumer, disconnectAccountResultConsumer } from "./kafka/consumer.js";
import { startGrpcServer } from "./grpc/grpc.server.js";
import { OutboxWorker } from "./workers/outbox.worker.js";
import { contractService } from "./services/contract.service.js";

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected");

    // 컨트랙트 배포 주소 1회 로드 (이후 API 요청에서 캐시된 값 사용)
    await contractService.load();

    // kafka producer (Outbox Worker가 PROOF_REQUESTED publish)
    await startProducer();

    // Kafka topic 사전 생성 (producer/consumer가 사용하기 전에 완료)
    await ensureTopics([
      { topic: env.kafkaProofRequestedTopic, numPartitions: env.kafkaProofRequestedPartitions },
      { topic: env.kafkaJobFailedTopic, numPartitions: env.kafkaJobFailedPartitions },
      { topic: env.kafkaAccountRegistrationResultTopic, numPartitions: env.kafkaAccountRegistrationResultPartitions },
    ]);

    // kafka consumer (PROOF_FAILED 처리)
    connectProofFailedConsumer().catch((error) => {
      console.error("Kafka consumer failed:", error);
      process.exit(1);
    });

    // kafka consumer (가입 확인 결과 처리)
    connectAccountResultConsumer().catch((error) => {
      console.error("Kafka account result consumer failed:", error);
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
        await disconnectAccountResultConsumer();
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
