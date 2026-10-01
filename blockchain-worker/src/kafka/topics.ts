import type { OutboxEventType, OutboxJobType } from "@prisma/client";
import { env } from "../config/env.js";

export interface WorkMessage {
  jobId: string;
  jobType: OutboxJobType;
  eventType: OutboxEventType;
}

// 단계별 Kafka topic
export const TOPICS = {
  transaction: env.kafkaTransactionTopic,
  receipt: env.kafkaReceiptTopic,
  result: env.kafkaResultTopic,
  fail: env.kafkaFailureTopic,
} as const;

// 단계별 Consumer Group
export const CONSUMER_GROUPS = {
  transaction: env.kafkaTransactionGroup,
  receipt: env.kafkaReceiptGroup,
  result: env.kafkaResultGroup,
} as const;

/**
 * eventType에 해당하는 Kafka topic을 반환한다.
 * 실패 이벤트(TRANSACTION_FAILED, PROOF_FAILED)는 Kafka로 publish하지 않고
 * Outbox Worker가 Market으로 직접 전달하므로 여기서는 예외를 던진다.
 */
export function topicForEventType(eventType: OutboxEventType): string {
  switch (eventType) {
    case "TRANSACTION_REQUESTED":
      return TOPICS.transaction;
    case "RECEIPT_CHECK_REQUESTED":
      return TOPICS.receipt;
    case "TRANSACTION_COMPLETED":
      return TOPICS.result;
    case "TRANSACTION_FAILED":
    case "PROOF_FAILED":
      return TOPICS.fail;
    default:
      throw new Error(`[blockchain-worker] unknown event type: ${eventType}`);
  }
}
