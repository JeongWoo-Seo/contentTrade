import { Blockchain, grpc } from "@content-trade/grpc-contract";
import { prisma } from "../lib/prisma.js";

export function createBlockchainServer(): grpc.Server {
  const server = new grpc.Server();

  server.addService(Blockchain.BlockchainServiceService, {
    submitContentRegistrationProof: async (call: any, callback: any): Promise<void> => {
      const request: Blockchain.SubmitContentRegistrationProofRequest = call.request;

      try {
        // 1. 검증
        if (
          !request.jobId ||
          request.registrationId <= 0 ||
          !request.proof ||
          !request.publicSignals ||
          request.publicSignals.length === 0
        ) {
          callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: "invalid job_id, registration_id, proof, or public_signals",
          });
          return;
        }

        // 2. 중복 jobId 검사
        const existing = await prisma.contentRegistrationTransaction.findUnique({
          where: { jobId: request.jobId },
        });
        if (existing) {
          callback({
            code: grpc.status.ALREADY_EXISTS,
            message: `duplicate jobId: ${request.jobId}`,
          });
          return;
        }

        // 3. PENDING 상태로 저장
        await prisma.contentRegistrationTransaction.create({
          data: {
            jobId: request.jobId,
            registrationId: request.registrationId,
            proof: request.proof,
            publicSignals: JSON.stringify(request.publicSignals),
            encryptedData: request.encryptedData,
            dataIv: request.dataIv,
            encryptedDataKey: request.encryptedDataKey,
            keyIv: request.keyIv,
            keyAuthTag: request.keyAuthTag,
            encryptionVersion: request.encryptionVersion,
            keyHash: request.keyHash,
            encryptedDataHash: request.encryptedDataHash,
            contentHash: request.contentHash,
            status: "PENDING",
          },
        });

        console.log(`[blockchain-worker] stored content registration jobId=${request.jobId} registrationId=${request.registrationId}`);
        callback(null, { success: true, message: "content registration proof accepted" });
      } catch (error) {
        console.error("[blockchain-worker] SubmitContentRegistrationProof error:", error);
        callback({ code: grpc.status.INTERNAL, message: String(error) });
      }
    },

    submitTradeApprovalProof: async (call: any, callback: any): Promise<void> => {
      const request: Blockchain.SubmitTradeApprovalProofRequest = call.request;

      try {
        // 1. 검증
        if (
          !request.jobId ||
          request.purchaseId <= 0 ||
          !request.proof ||
          !request.publicSignals ||
          request.publicSignals.length === 0
        ) {
          callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: "invalid job_id, purchase_id, proof, or public_signals",
          });
          return;
        }

        // 2. 중복 jobId 검사
        const existing = await prisma.tradeApprovalTransaction.findUnique({
          where: { jobId: request.jobId },
        });
        if (existing) {
          callback({
            code: grpc.status.ALREADY_EXISTS,
            message: `duplicate jobId: ${request.jobId}`,
          });
          return;
        }

        // 3. PENDING 상태로 저장
        await prisma.tradeApprovalTransaction.create({
          data: {
            jobId: request.jobId,
            purchaseId: request.purchaseId,
            proof: request.proof,
            publicSignals: JSON.stringify(request.publicSignals),
            status: "PENDING",
          },
        });

        console.log(
          `[blockchain-worker] stored trade approval jobId=${request.jobId} purchaseId=${request.purchaseId}`,
        );
        callback(null, { success: true, message: "trade approval proof accepted" });
      } catch (error) {
        console.error("[blockchain-worker] SubmitTradeApprovalProof error:", error);
        callback({ code: grpc.status.INTERNAL, message: String(error) });
      }
    },
  });

  return server;
}
