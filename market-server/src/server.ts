import "dotenv/config";

import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { startProducer } from "./kafka/producer.js";
import {connectFailedConsumer} from "./kafka/consumer.js"

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected");

    await startProducer();

    connectFailedConsumer().catch((error) => {
      console.error("Kafka consumer failed:", error);
      process.exit(1);
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

startServer();