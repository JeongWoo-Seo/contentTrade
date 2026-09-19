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
} as const;

// 단계별 Consumer Group
export const CONSUMER_GROUPS = {
  transaction: env.kafkaTransactionGroup,
  receipt: env.kafkaReceiptGroup,
  result: env.kafkaResultGroup,
} as const;

export function topicForEventType(eventType: OutboxEventType): string {
  switch (eventType) {
    case "TRANSACTION_REQUESTED":
      return TOPICS.transaction;
    case "RECEIPT_CHECK_REQUESTED":
      return TOPICS.receipt;
    case "TRANSACTION_COMPLETED":
    case "TRANSACTION_FAILED":
      return TOPICS.result;
    default:
      throw new Error(`[blockchain-worker] unknown event type: ${eventType}`);
  }
}
