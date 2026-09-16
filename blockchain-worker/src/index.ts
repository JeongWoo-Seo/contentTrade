import "dotenv/config";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";
import { closeMarketClient } from "./grpc/market.client.js";
import { prisma } from "./lib/prisma.js";
import { env } from "./config/env.js";
import { startGrpcServer } from "./grpc/server.js";
import { TransactionWorker } from "./workers/transaction.worker.js";
import { ReceiptWorker } from "./workers/receipt.worker.js";
import { ResultSendWorker } from "./workers/resultSend.worker.js";

async function main(): Promise<void> {
    // Kafka producer (실패 메시지 발행용)
    await connectProducer();

    // gRPC server (proof-worker가 proof를 제출)
    const server = await startGrpcServer(env.port);
    console.log(`[blockchain-worker] gRPC server started on port ${env.port}`);

    // Workers (PENDING/SUBMITTED 폴링)
    const transactionWorker = new TransactionWorker();
    const receiptWorker = new ReceiptWorker();
    const resultSendWorker = new ResultSendWorker();

    transactionWorker.start().catch((error) => {
        console.error("[blockchain-worker] transaction worker crashed:", error);
    });

    receiptWorker.start().catch((error) => {
        console.error("[blockchain-worker] receipt worker crashed:", error);
    });

    resultSendWorker.start().catch((error) => {
        console.error("[blockchain-worker] result send worker crashed:", error);
    });

    // graceful shutdown
    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;

        console.log(`[blockchain-worker] received ${signal}, shutting down...`);
        try {
            transactionWorker.stop();
            receiptWorker.stop();
            resultSendWorker.stop();

            await new Promise<void>((resolve) => server.tryShutdown(() => resolve()));
            await disconnectProducer();
            closeMarketClient();
            await prisma.$disconnect();

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
