export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "market-server",
  kafkaServerIdPrefix: process.env.KAFKA_CLIENT_ID_PREFIX ?? "market-server",
  kafkaProofRequestedTopic: process.env.KAFKA_PROOF_REQUESTED_TOPIC ?? "proof_requested",
  kafkaJobFailedTopic: process.env.KAFKA_JOB_FAILED_TOPIC ?? "job_failed",
  kafkaReceiptTopic: process.env.KAFKA_RECEIPT_TOPIC ?? "blockchain_receipt",
  kafkaAccountRegistrationResultTopic: process.env.KAFKA_ACCOUNT_REGISTRATION_RESULT_TOPIC ?? "account_registration_result",
  kafkaProofRequestedPartitions: Number(process.env.KAFKA_PROOF_REQUESTED_PARTITIONS) || 1,
  kafkaJobFailedPartitions: Number(process.env.KAFKA_JOB_FAILED_PARTITIONS) || 1,
  kafkaAccountRegistrationResultPartitions: Number(process.env.KAFKA_ACCOUNT_REGISTRATION_RESULT_PARTITIONS) || 1,

  marketGrpcHost: process.env.MARKET_GRPC_HOST ?? "localhost:50051",

  // 서버 ZK 공개키 (거래 정보 응답에 포함)
  pkOwn: process.env.PK_OWN ?? "",
  pkEnc: process.env.PK_ENC ?? "",

  // 컨트랙트 배포 정보 (contract/deployments)
  contractDeploymentDir: process.env.CONTRACT_DEPLOYMENT_DIR ?? "../contract/deployments",
  chainId: Number(process.env.CHAIN_ID) || 31337,

  // Outbox Worker polling 주기 (ms)
  outboxWorkerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS) || 1000,
};
