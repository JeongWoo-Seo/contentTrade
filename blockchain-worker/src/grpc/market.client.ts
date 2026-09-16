import { grpc, Market } from "@content-trade/grpc-contract";
import { env } from "../config/env.js";

// market-server의 gRPC Client (성공 결과 전달용).
// packages/grpc-contract의 generated client를 그대로 사용한다.
const client = new Market.MarketServiceClient(
  env.marketGrpcUrl,
  grpc.credentials.createInsecure(),
);

export function completeContentRegistration(
  request: Market.CompleteContentRegistrationRequest,
): Promise<Market.CompleteContentRegistrationResponse> {
  return new Promise((resolve, reject) => {
    client.completeContentRegistration(request, (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

export function closeMarketClient(): void {
  client.close();
}
