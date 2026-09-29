import { Kafka, type Consumer } from "kafkajs";
import { env } from "../config/env.js";

// worker별로 고유한 clientId를 갖는 Kafka Consumer를 생성한다.
// 모든 worker는 동일한 Consumer Group(groupId)을 사용한다.
export function createConsumer(clientId: string): Consumer {
  const kafka = new Kafka({
    clientId,
    brokers: env.kafkaBrokers,
  });

  return kafka.consumer({
    groupId: env.kafkaGroupId,
  });
}
