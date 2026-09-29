import { grpc, Market } from "@content-trade/grpc-contract";
import { env } from "../config/env.js";

const client = new Market.MarketServiceClient(
  env.marketGrpcHost,
  grpc.credentials.createInsecure(),
);

export function getContentRegistrationSource(
  registrationId: number,
  jobId: string,
): Promise<Market.GetContentRegistrationResponse> {
  return new Promise((resolve, reject) => {
    client.getContentRegistration({ registrationId, jobId }, (error, response) => {
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
