import { redis } from "./client.js";
import type { OutboxEventType, OutboxJobType } from "@prisma/client";

/**
 * Redis Stream 메시지. 큰 데이터(proof, encryptedData 등)는 넣지 않는다.
 * 실제 데이터는 Worker가 jobId로 PostgreSQL에서 조회한다.
 */
export interface StreamMessage {
  id: string;
  jobId: string;
  jobType: OutboxJobType;
  eventType: OutboxEventType;
}

// 단계별 Stream
export const STREAMS = {
  transaction: "blockchain:transaction",
  receipt: "blockchain:receipt",
  result: "blockchain:result",
} as const;

// 단계별 Consumer Group
export const GROUPS = {
  transaction: "transaction-workers",
  receipt: "receipt-workers",
  result: "result-workers",
} as const;

// pending 메시지 reclaim 기준(ms). Worker가 죽었을 때 이 시간이 지나면 재처리한다.
const RECLAIM_IDLE_MS = 60_000;

export function streamForEventType(eventType: OutboxEventType): string {
  switch (eventType) {
    case "TRANSACTION_REQUESTED":
      return STREAMS.transaction;
    case "RECEIPT_CHECK_REQUESTED":
      return STREAMS.receipt;
    case "TRANSACTION_COMPLETED":
    case "TRANSACTION_FAILED":
      return STREAMS.result;
    default:
      throw new Error(`[blockchain-worker] unknown event type: ${eventType}`);
  }
}

/**
 * 각 Stream에 Consumer Group을 생성한다. 이미 존재하면(BUSYGROUP) 무시한다.
 */
export async function ensureConsumerGroups(): Promise<void> {
  const pairs: Array<[string, string]> = [
    [STREAMS.transaction, GROUPS.transaction],
    [STREAMS.receipt, GROUPS.receipt],
    [STREAMS.result, GROUPS.result],
  ];

  for (const [stream, group] of pairs) {
    try {
      await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("BUSYGROUP")) {
        throw error;
      }
    }
  }
}

/**
 * Outbox eventType에 해당하는 Stream에 이벤트를 publish한다.
 */
export async function publishEvent(
  eventType: OutboxEventType,
  message: { jobId: string; jobType: OutboxJobType },
): Promise<void> {
  const stream = streamForEventType(eventType);
  await redis.xadd(
    stream,
    "*",
    "jobId",
    message.jobId,
    "jobType",
    message.jobType,
    "eventType",
    eventType,
  );
}

type RawStreamEntry = [string, string[]]; // [messageId, flatFields]

function parseEntries(entries: RawStreamEntry[]): StreamMessage[] {
  const messages: StreamMessage[] = [];
  for (const [id, fields] of entries) {
    const map = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) {
      map.set(fields[i], fields[i + 1]);
    }
    messages.push({
      id,
      jobId: map.get("jobId") ?? "",
      jobType: (map.get("jobType") ?? "CONTENT_REGISTRATION") as OutboxJobType,
      eventType: (map.get("eventType") ?? "TRANSACTION_REQUESTED") as OutboxEventType,
    });
  }
  return messages;
}

/**
 * Consumer Group으로부터 새 메시지(`>`)를 읽는다.
 */
export async function consumeGroup(
  stream: string,
  group: string,
  consumer: string,
  blockMs: number,
  count = 10,
): Promise<StreamMessage[]> {
  const results = (await redis.xreadgroup(
    "GROUP",
    group,
    consumer,
    "COUNT",
    count,
    "BLOCK",
    blockMs,
    "STREAMS",
    stream,
    ">",
  )) as Array<[string, RawStreamEntry[]]> | null;

  if (!results || results.length === 0) {
    return [];
  }

  const messages: StreamMessage[] = [];
  for (const [, entries] of results) {
    messages.push(...parseEntries(entries));
  }
  return messages;
}

/**
 * 오랫동안 idle한 pending 메시지를 reclaim한다. (worker 사망 복구)
 */
export async function reclaimPending(
  stream: string,
  group: string,
  consumer: string,
  count = 10,
): Promise<StreamMessage[]> {
  const result = (await redis.xautoclaim(
    stream,
    group,
    consumer,
    RECLAIM_IDLE_MS,
    "0-0",
    "COUNT",
    count,
  )) as [string, RawStreamEntry[], string[]];

  return parseEntries(result[1]);
}

export async function ackMessage(stream: string, group: string, id: string): Promise<void> {
  await redis.xack(stream, group, id);
}

export interface StreamConsumerOptions {
  stream: string;
  group: string;
  consumer: string;
  blockMs: number;
  reclaimIntervalMs: number;
  process: (message: StreamMessage) => Promise<void>;
  shouldRun: () => boolean;
}

/**
 * Redis Stream Consumer Group 기반 처리 루프.
 * - 새 메시지(`>`)를 읽어 처리 후 ACK.
 * - idle한 pending 메시지를 reclaim하여 재처리(worker 사망 복구).
 * - 처리 실패(throw) 시 ACK하지 않아 pending으로 남겨 재처리한다.
 */
export async function runStreamConsumer(
  options: StreamConsumerOptions,
): Promise<void> {
  await Promise.all([
    consumeLoop(options),
    reclaimLoop(options),
  ]);
}

async function consumeLoop(
  options: StreamConsumerOptions,
): Promise<void> {
  while (options.shouldRun()) {
    try {
      const messages = await consumeGroup(
        options.stream,
        options.group,
        options.consumer,
        options.blockMs,
      );

      for (const message of messages) {
        await processAndAck(options, message);
      }
    } catch (error) {
      console.error(`[blockchain-worker] consumer error (${options.group}):`,error);

      await sleep(1000);
    }
  }
}

/**
 * 장애가 발생한 worker의 Pending 메시지 복구
 */
async function reclaimLoop(
  options: StreamConsumerOptions,
): Promise<void> {
  while (options.shouldRun()) {
    try {
      const pending = await reclaimPending(
        options.stream,
        options.group,
        options.consumer,
      );

      for (const message of pending) {
        await processAndAck(options, message);
      }
    } catch (error) {
      console.error(`[blockchain-worker] reclaim error (${options.group}):`,error);
    }

    await sleep(options.reclaimIntervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processAndAck(options: StreamConsumerOptions, message: StreamMessage): Promise<void> {
  try {
    await options.process(message);
    await ackMessage(options.stream, options.group, message.id);
  } catch (error) {
    console.error(`[blockchain-worker] process failed (${options.group}) jobId=${message.jobId}:`,error);
    // ACK하지 않음 → pending으로 남아 reclaim에서 재처리
  }
}
