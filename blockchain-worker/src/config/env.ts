// blockchain-worker 환경 설정
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // gRPC server (proof-worker가 SubmitProof를 호출)
  port: Number(process.env.BLOCKCHAIN_WORKER_PORT) || 50052,

  // Kafka (실패 메시지 발행용)
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? "blockchain-worker",
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "blockchain-worker",

  // market-server gRPC (성공 결과 전달용)
  marketGrpcUrl: process.env.MARKET_GRPC_URL ?? "localhost:50051",

  // Kafka 실패 메시지 토픽
  kafkaFailureTopic: process.env.KAFKA_FAILURE_TOPIC ?? "PROOF_FAILED",

  // Worker polling intervals (ms)
  transactionWorkerIntervalMs: Number(process.env.TRANSACTION_WORKER_INTERVAL_MS) || 1000,
  receiptWorkerIntervalMs: Number(process.env.RECEIPT_WORKER_INTERVAL_MS) || 5000,
  resultSendWorkerIntervalMs: Number(process.env.RESULT_SEND_WORKER_INTERVAL_MS) || 5000,
  
};
