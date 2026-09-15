export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
  kafkaGroupId: process.env.KAFKA_GROUP_ID ?? "proof-worker-group",
  kafkaServerIdPrefix: process.env.KAFKA_CLIENT_ID_PREFIX ?? "market-server",

  // gRPC (market-server)
  marketGrpcHost: process.env.MARKET_GRPC_HOST ?? "localhost:50051",
};
