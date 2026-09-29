import { Kafka } from "kafkajs";
import type { BlockchainTransactionMessage, JobFailedMessage } from "./types.js";
import { env } from "../config/env.js";
import os from "node:os";

const kafka = new Kafka({
  clientId: `${env.kafkaClientIdPrefix}-${os.hostname()}-producer`,
  brokers: env.kafkaBrokers,
});

const producer = kafka.producer();

export async function connectProducer(): Promise<void> {
  await producer.connect();
  console.log("[proof-worker] Kafka producer connected");
}

export async function disconnectProducer(): Promise<void> {
  await producer.disconnect();
}

/**
 * topic으로 메시지를 발행한다. value는 JSON 직렬화한다.
 * key는 jobId로 지정해 같은 job의 메시지가 같은 partition에 배치되도록 한다.
 */
export async function sendMessage(
  topic: string,
  key: string,
  message: unknown,
): Promise<void> {
  await producer.send({
    topic,
    messages: [{ key, value: JSON.stringify(message) }],
  });
}

export async function sendProofFailed(message: JobFailedMessage): Promise<void> {
  await sendMessage(env.kafkaFailureTopic, message.jobId, message);
}

export async function sendBlockchainTransaction(
  message: BlockchainTransactionMessage,
): Promise<void> {
  await sendMessage(env.kafkaTransactionTopic, message.jobId, message);
}

/**
 * Kafka topic을 미리 생성한다(partition 수 지정).
 * 이미 존재하면 현재 partition 수가 목표보다 적을 때만 증가시킨다.
 */
export async function ensureTopics(
  topics: Array<{ topic: string; numPartitions: number }>,
): Promise<void> {
  const admin = kafka.admin();

  await admin.connect();

  try {
    try {
      await admin.createTopics({
        topics,
        waitForLeaders: true,
      });
    } catch (error) {
      // 기존 topic(TOPIC_ALREADY_EXISTS) 등은 정상 처리. partition 증가는 아래에서 수행.
      console.warn(
        `[proof-worker] createTopics skipped (topics may already exist):`,
        error instanceof Error ? error.message : String(error),
      );
    }

    for (const topic of topics) {
      const metadata = await admin.fetchTopicMetadata({
        topics: [topic.topic],
      });

      const currentPartitions = metadata.topics[0]?.partitions.length ?? 0;

      if (currentPartitions > 0 && currentPartitions < topic.numPartitions) {
        await admin.createPartitions({
          topicPartitions: [
            {
              topic: topic.topic,
              count: topic.numPartitions,
            },
          ],
        });
      }
    }

    console.log(`[proof-worker] ensured topics: ${topics.map((t) => t.topic).join(", ")}`);
  } finally {
    await admin.disconnect();
  }
}
