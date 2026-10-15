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
    topic: env.kafkaProofRequestedTopic,
    messages: [
      {
        key: message.jobId,
        value: JSON.stringify(message),
      },
    ],
  });
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

    console.log(`[market-server] ensured topics: ${topics.map((t) => t.topic).join(", ")}`);
  } finally {
    await admin.disconnect();
  }
}
