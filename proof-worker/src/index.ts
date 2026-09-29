import "dotenv/config";
import { WorkerManager } from "./workers/worker-manager.js";
import { prisma } from "./lib/prisma.js";

async function main(): Promise<void> {
  // db
  await prisma.$connect();

  // worker 생성
  const manager = new WorkerManager();
  await manager.start();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`Received ${signal}, shutting down...`);
    try {
      await manager.stop();
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("shutdown failed:", error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (error) => {
  console.error("proof-worker failed:", error);

  await prisma.$disconnect();

  process.exit(1);
});