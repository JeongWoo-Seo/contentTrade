import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Redis 클라이언트 (Streams 사용).
 * maxRetriesPerRequest를 null로 설정하여 blocking 명령(XREADGROUP)이
 * 재시도 없이 block timeout까지 대기하도록 한다.
 */
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export async function connectRedis(): Promise<void> {
  await redis.ping();
  console.log("[blockchain-worker] Redis connected");
}

export async function disconnectRedis(): Promise<void> {
  // blocking 명령(XREADGROUP)을 즉시 해제하기 위해 graceful quit 대신 disconnect 사용
  redis.disconnect();
}
