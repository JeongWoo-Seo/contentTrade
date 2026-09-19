import { Kafka, type EachMessagePayload } from "kafkajs";
import { env } from "../config/env.js";
import type { WorkMessage } from "./topics.js";

const kafka = new Kafka({
  clientId: `${env.kafkaClientId}-consumer`,
  brokers: env.kafkaBrokers,
});

export interface ConsumerOptions {
  topic: string;
  groupId: string;
  process: (message: WorkMessage) => Promise<void>;
  shouldRun: () => boolean;
}

/**
 * Kafka Consumer Group 기반 처리.
 * - 각 메시지를 process로 처리한다.
 * - 처리 성공 시 offset을 commit한다(autoCommit=false + 수동 commit).
 * - 처리 실패 시 commit하지 않아 restart/rebalance 시 재처리된다.
 *   (재처리 + DB 기반 복구는 recovery worker가 담당)
 * - 같은 groupId의 consumer들이 partition을 분담한다.
 * await options.process(workMessage); 내에서는 무조건 같은 메시지가 입력되어도 중복 문제가 없도록 처리가 필요.
 */
export async function startConsumer(options: ConsumerOptions): Promise<void> {
  const consumer = kafka.consumer({ groupId: options.groupId, allowAutoTopicCreation: false });

  await consumer.connect();
  await consumer.subscribe({ topic: options.topic, fromBeginning: false });

  const runPromise = consumer.run({
    autoCommit: false,
    eachMessage: async (payload: EachMessagePayload) => {
      if (!options.shouldRun()) {
        return;
      }
      try {
        const workMessage = parseWorkMessage(payload.message.value);
        await options.process(workMessage);

        // 처리 성공 → 다음 offset commit
        const nextOffset = String(Number(payload.message.offset) + 1);
        await consumer.commitOffsets([
          { topic: payload.topic, partition: payload.partition, offset: nextOffset },
        ]);
      } catch (error) {
        console.error(
          `[blockchain-worker] consumer process failed (${options.groupId}) ` +
            `topic=${payload.topic} partition=${payload.partition}:`,
          error,
        );
        // commit하지 않음 → 재처리 (restart/rebalance) + recovery worker가 DB 기준 복구
      }
    },
  });

  // stop 신호를 기다린 후 graceful disconnect
  while (options.shouldRun()) {
    await sleep(200);
  }

  await consumer.disconnect();
  await runPromise.catch(() => {});
}

function parseWorkMessage(value: Buffer | null): WorkMessage {
  return JSON.parse(value?.toString() ?? "{}") as WorkMessage;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
