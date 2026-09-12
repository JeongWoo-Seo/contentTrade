import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "market-server",
  brokers: process.env.KAFKA_BROKERS!.split(","),
});