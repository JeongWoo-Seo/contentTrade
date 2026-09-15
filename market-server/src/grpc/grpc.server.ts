import grpc from "@grpc/grpc-js";
import { createGrpcServer } from "./market.server.js";

const GRPC_PORT = Number(process.env.GRPC_PORT) || 50051;

export function startGrpcServer() {
  const grpcServer = createGrpcServer();

  grpcServer.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error("gRPC server failed:", error);
        return;
      }

      console.log(`gRPC server running on ${port}`);
    }
  );
}