import { Kafka } from "kafkajs";
import type { JobFailedMessage } from "./types.js";
import { env } from "../config/env.js";

const kafka = new Kafka({
  clientId: `${env.kafkaClientId}-producer`,
  brokers: env.kafkaBrokers,
});

const producer = kafka.producer();

export async function connectProducer(): Promise<void> {
  await producer.connect();
  console.log("[blockchain-worker] Kafka producer connected");
}

export async function disconnectProducer(): Promise<void> {
  await producer.disconnect();
}

export async function sendBlockchainFailed(message: JobFailedMessage): Promise<void> {
  await producer.send({
    topic: env.kafkaFailureTopic,
    messages: [{ key: message.jobId, value: JSON.stringify(message) }],
  });
}
