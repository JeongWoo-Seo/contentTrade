import "dotenv/config";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { startProducer } from "./kafka/producer.js";
import { connectProofFailedConsumer } from "./kafka/consumer.js"
import {startGrpcServer} from "./grpc/grpc.server.js"

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    //db
    await prisma.$connect();
    console.log("PostgreSQL connected");

    // kafka
    await startProducer();

    connectProofFailedConsumer().catch((error) => {
      console.error("Kafka consumer failed:", error);
      process.exit(1);
    });

    // grpc
    startGrpcServer()

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("server failed:", error);
    process.exit(1);
  }
}

startServer();