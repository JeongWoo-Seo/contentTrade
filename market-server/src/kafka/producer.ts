import { kafka } from "./kafka.js";
import {MarketKafkaMessage} from "../types/message.js"

const producer = kafka.producer();

export async function startProducer() {
  await producer.connect();

  console.log("Kafka producer connected");
}

export async function sendProofRequested(
  message: MarketKafkaMessage
): Promise<void> {
  await producer.send({
    topic: "PROOF_REQUESTED",
    messages: [
      {
        key: message.jobId,
        value: JSON.stringify(message),
      },
    ],
  });
}

/*
await sendProofRequested({
  jobId: crypto.randomUUID(),
  proofType: "CONTENT_REGISTRATION",
  registrationId: 123,
  requestedAt: new Date().toISOString(),
});


await sendProofRequested({
  jobId: crypto.randomUUID(),
  proofType: "TRADE_APPROVAL",
  purchaseId: 456,
  requestedAt: new Date().toISOString(),
});
*/
