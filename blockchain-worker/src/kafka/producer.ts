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

/**
 * topic으로 메시지를 발행한다. value는 JSON 직렬화한다.
 * key는 jobId로 지정해 같은 job의 이벤트가 같은 partition에 배치되도록 한다.
 */
export async function sendMessage(topic: string, key: string, message: unknown): Promise<void> {
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(message) }],
  });
}

export async function sendBlockchainFailed(message: JobFailedMessage): Promise<void> {
  await sendMessage(env.kafkaFailureTopic, message.jobId, message);
}

/**
 * Kafka topic을 미리 생성한다(partition 수 지정).
 * consumer가 subscribe할 때 topic이 없어 발생하는 UNKNOWN_TOPIC_OR_PARTITION을 방지한다.
 */
export async function ensureTopics(
  topics: Array<{ topic: string; numPartitions: number }>,
): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      topics,
      waitForLeaders: true,
    });

    // 기존 topic의 partition 수가 목표보다 적으면 증가시킨다.
    for (const t of topics) {
      const meta = await admin.fetchTopicMetadata({ topics: [t.topic] });
      const current = meta.topics[0]?.partitions.length ?? 0;
      if (current > 0 && current < t.numPartitions) {
        await admin.createPartitions({
          topicPartitions: [{ topic: t.topic, count: t.numPartitions }],
        });
      }
    }

    console.log(`[blockchain-worker] ensured topics: ${topics.map((t) => t.topic).join(", ")}`);
  } finally {
    await admin.disconnect();
  }
}
