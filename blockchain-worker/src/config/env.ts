function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "blockchain-worker",
  kafkaFailureTopic: process.env.KAFKA_FAILURE_TOPIC ?? "PROOF_FAILED",

  kafkaTransactionTopic: process.env.KAFKA_TRANSACTION_TOPIC ?? "blockchain.transaction",
  kafkaReceiptTopic: process.env.KAFKA_RECEIPT_TOPIC ?? "blockchain.receipt",
  kafkaResultTopic: process.env.KAFKA_RESULT_TOPIC ?? "blockchain.result",

  kafkaTransactionGroup: process.env.KAFKA_TRANSACTION_GROUP ?? "transaction-workers",
  kafkaReceiptGroup: process.env.KAFKA_RECEIPT_GROUP ?? "receipt-workers",
  kafkaResultGroup: process.env.KAFKA_RESULT_GROUP ?? "result-workers",

  // Market gRPC
  marketGrpcUrl: process.env.MARKET_GRPC_URL ?? "localhost:50051",

  // Worker
  outboxWorkerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS) || 1000,
  recoveryWorkerIntervalMs: Number(process.env.RECOVERY_WORKER_INTERVAL_MS) || 10000,

  // Blockchain
  ethereumRpcUrl: requireEnv("BLOCKCHAIN_RPC_URL"),
  blockchainPrivateKey: requireEnv("PRIVATE_KEY"),
  contentTradeContractAddress: requireEnv("CONTRACT_ADDRESS"),
};
