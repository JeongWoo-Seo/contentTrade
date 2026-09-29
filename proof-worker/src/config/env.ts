function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }

  return value;
}

// proof-worker 환경 설정
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  masterKey: requiredEnv("MASTER_KEY"),

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "proof-worker",
  kafkaClientIdPrefix: process.env.KAFKA_CLIENT_ID_PREFIX ?? "proof-worker",

  kafkaRequestTopic: process.env.KAFKA_REQUEST_TOPIC ?? "PROOF_REQUESTED",
  kafkaFailureTopic: process.env.KAFKA_FAILURE_TOPIC ?? "PROOF_FAILED",
  kafkaTransactionTopic: process.env.KAFKA_TRANSACTION_TOPIC ?? "blockchain.transaction",

  // gRPC (market-server)
  marketGrpcHost: process.env.MARKET_GRPC_HOST ?? "localhost:50051",

  // Worker 개수 (Kafka consumer partition 수 결정)
  proofWorkerCount: Number(process.env.PROOF_WORKER_COUNT ?? 1),
};
