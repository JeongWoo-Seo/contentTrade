import { kafka } from "./kafka.js";
import {MarketKafkaMessage} from "./types.js"
import { env } from "../config/env.js";

const producer = kafka.producer({
  retry: {
    retries: 5,
    initialRetryTime: 300,
    maxRetryTime: 30000,
  },
});

export async function startProducer() {
  await producer.connect();

  console.log("Kafka producer connected");
}

export async function disconnectProducer(): Promise<void> {
  await producer.disconnect();
}

export async function sendProofRequested(
  message: MarketKafkaMessage
): Promise<void> {
  await producer.send({
    topic: env.kafkaRequestTopic,
    messages: [
      {
        key: message.jobId,
        value: JSON.stringify(message),
      },
    ],
  });
}
