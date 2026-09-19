// blockchain-worker 환경 설정
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Redis (Streams / Outbox 전달용)
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  redisBlockTimeoutMs: Number(process.env.REDIS_BLOCK_TIMEOUT_MS) || 5000,
  redisReclaimIntervalMs: Number(process.env.REDIS_BLOCK_TIMEOUT_MS) || 10000,

  // Kafka (실패 메시지 발행용)
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "blockchain-worker",
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "blockchain-worker",
  kafkaFailureTopic: process.env.KAFKA_FAILURE_TOPIC ?? "PROOF_FAILED",

  // market-server gRPC (성공 결과 전달용)
  marketGrpcUrl: process.env.MARKET_GRPC_URL ?? "localhost:50051",

  // Worker 폴링 주기 (ms)
  outboxWorkerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS) || 1000,
  recoveryWorkerIntervalMs: Number(process.env.RECOVERY_WORKER_INTERVAL_MS) || 10000,
};
