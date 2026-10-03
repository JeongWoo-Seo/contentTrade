export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "proof-worker-group",
  kafkaServerIdPrefix: process.env.KAFKA_CLIENT_ID_PREFIX ?? "market-server",
  kafkaRequestTopic: process.env.KAFKA_REQUEST_TOPIC ?? "proof_requested",
  kafkaFailureTopic: process.env.KAFKA_FAILURE_TOPIC ?? "job_failed",

  // gRPC (market-server)
  marketGrpcHost: process.env.MARKET_GRPC_HOST ?? "localhost:50051",

  // Outbox Worker polling 주기 (ms)
  outboxWorkerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS) || 1000,
};
