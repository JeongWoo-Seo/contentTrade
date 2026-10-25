import { kafka } from "./kafka.js";
import type { ProofRequestedMessage, AccountRegistrationMessage } from "./types.js";
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
  message: ProofRequestedMessage
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

export async function sendAccountRegistration(
  message: AccountRegistrationMessage
): Promise<void> {
  await producer.send({
    topic: env.kafkaReceiptTopic,
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

  try {
    await admin.connect();
    console.log("[market-server] Kafka admin connected");

    try {
      const created = await admin.createTopics({
        topics,
        waitForLeaders: true,
      });

      console.log(`[market-server] createTopics result: ${created ? "at least one topic created" : "no topics created (possibly already exist)"}`,
      );
    } catch (error: unknown) {
      console.error("[market-server] Failed to create Kafka topics");

      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);

        const kafkaError = error as Error & {
          type?: string;
          code?: number;
          retriable?: boolean;
          topics?: unknown;
        };

        console.error("Error type:", kafkaError.type);
        console.error("Error code:", kafkaError.code);
        console.error("Retriable:", kafkaError.retriable);
        console.error("Error topics:", kafkaError.topics);
        console.error("Error stack:", error.stack);
      } else {
        console.error("Unknown error:", error);
      }

      // 생성 실패가 이미 존재하는 토픽 때문일 수도 있으므로,
      // 메타데이터를 확인한 뒤 아래 검증을 계속 진행한다.
    }

    // 토픽별 메타데이터 확인 및 파티션 수 검증
    for (const t of topics) {
      try {
        const meta = await admin.fetchTopicMetadata({
          topics: [t.topic],
        });

        const topicMeta = meta.topics.find((item) => item.name === t.topic);
        const current = topicMeta?.partitions.length ?? 0;

        console.log(`[market-server] Topic "${t.topic}": currentPartitions=${current}, targetPartitions=${t.numPartitions}`);

        if (current === 0) {
          console.error(`[market-server] Topic "${t.topic}" was not found or has no partitions`);
          throw new Error(`Kafka topic unavailable: ${t.topic}`);
        }

        if (current < t.numPartitions) {
          console.log(`[market-server] Increasing partitions for "${t.topic}": ${current} -> ${t.numPartitions}`);

          await admin.createPartitions({
            topicPartitions: [
              { topic: t.topic, count: t.numPartitions },
            ],
          });

          console.log(`[market-server] Partitions increased for "${t.topic}"`);
        } else if (current > t.numPartitions) {
          console.warn(`[market-server] Topic "${t.topic}" already has ${current} partitions; target is ${t.numPartitions}. Kafka cannot reduce partition count.`);
        }
      } catch (error: unknown) {
        console.error(`[market-server] Failed to verify or update topic "${t.topic}"`, error);
        throw error;
      }
    }

    console.log(`[market-server] ensured topics: ${topics.map((t) => t.topic).join(", ")}`);
  } catch (error: unknown) {
    console.error("[market-server] ensureTopics failed:", error);
    throw error;
  } finally {
    await admin.disconnect().catch((error: unknown) => {
      console.error("[market-server] Kafka admin disconnect failed:", error);
    });
  }
}