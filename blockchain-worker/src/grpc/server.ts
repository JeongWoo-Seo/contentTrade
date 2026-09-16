import { grpc } from "@content-trade/grpc-contract";
import { createBlockchainServer } from "./blockchain.server.js";

export function startGrpcServer(port: number): Promise<grpc.Server> {
    const server = createBlockchainServer();

    return new Promise((resolve, reject) => {
        server.bindAsync(
            `0.0.0.0:${port}`,
            grpc.ServerCredentials.createInsecure(),
            (error, boundPort) => {
                if (error) {
                    reject(error);
                    return;
                }

                console.log(`[blockchain-worker] gRPC server listening on port ${boundPort}`,);

                resolve(server);
            },
        );
    });
}