import { Blockchain, grpc } from "@content-trade/grpc-contract";
import {contentRegistrationTransactionRepository} from "../repositories/content-registration.repository.js";
import {tradeApprovalTransactionRepository} from "../repositories/trade-approval.repository.js";

export function createBlockchainServer(): grpc.Server {
  const server = new grpc.Server();

  server.addService(
    Blockchain.BlockchainServiceService,
    {
      /**
       * 소설 등록 Proof 제출
       */
      submitContentRegistrationProof: async (
        call: any,
        callback: any,
      ): Promise<void> => {
        const request: Blockchain.SubmitContentRegistrationProofRequest = call.request;

        try {
          // 1. 요청 검증
          const validationError = validateContentRegistrationRequest(request);

          if (validationError) {
            callback({
              code: grpc.status.INVALID_ARGUMENT,
              message: validationError,
            });
            return;
          }

          // 2. jobId 중복 확인
          const existing = await contentRegistrationTransactionRepository.findByJobId(request.jobId);

          if (existing) {
            callback({
              code: grpc.status.ALREADY_EXISTS,
              message: `duplicate jobId: ${request.jobId}`,
            });
            return;
          }

          // 3. DB에 PENDING 작업 생성
          await contentRegistrationTransactionRepository.create({
            jobId: request.jobId,
            registrationId: request.registrationId,
            proof: request.proof,
            publicSignals: request.publicSignals,

            encryptedData: request.encryptedData,
            dataIv: request.dataIv,
            encryptedDataKey: request.encryptedDataKey,
            keyIv: request.keyIv,
            keyAuthTag: request.keyAuthTag,

            encryptionVersion: request.encryptionVersion,

            keyHash: request.keyHash,
            encryptedDataHash: request.encryptedDataHash,
            contentHash: request.contentHash,
          });

          console.log(
            `[blockchain-worker] stored content registration ` +
              `jobId=${request.jobId} ` +
              `registrationId=${request.registrationId}`,
          );

          callback(null, {
            success: true,
            message: "content registration proof accepted",
          });
        } catch (error) {
          console.error("[blockchain-worker] SubmitContentRegistrationProof error:",error);

          callback({
            code: grpc.status.INTERNAL,
            message: getErrorMessage(error),
          });
        }
      },

      /**
       * 거래 승인 Proof 제출
       */
      submitTradeApprovalProof: async (
        call: any,
        callback: any,
      ): Promise<void> => {
        const request: Blockchain.SubmitTradeApprovalProofRequest =
          call.request;

        try {
          // 1. 요청 검증
          const validationError = validateTradeApprovalRequest(request);

          if (validationError) {
            callback({
              code: grpc.status.INVALID_ARGUMENT,
              message: validationError,
            });
            return;
          }

          // 2. jobId 중복 확인
          const existing = await tradeApprovalTransactionRepository.findByJobId(request.jobId);

          if (existing) {
            callback({
              code: grpc.status.ALREADY_EXISTS,
              message: `duplicate jobId: ${request.jobId}`,
            });
            return;
          }

          // 3. DB에 PENDING 작업 생성
          await tradeApprovalTransactionRepository.create({
            jobId: request.jobId,
            purchaseId: request.purchaseId,
            proof: request.proof,
            publicSignals: request.publicSignals,
          });

          console.log(
            `[blockchain-worker] stored trade approval ` +
              `jobId=${request.jobId} ` +
              `purchaseId=${request.purchaseId}`,
          );

          callback(null, {
            success: true,
            message: "trade approval proof accepted",
          });
        } catch (error) {
          console.error("[blockchain-worker] SubmitTradeApprovalProof error:",error);

          callback({
            code: grpc.status.INTERNAL,
            message: getErrorMessage(error),
          });
        }
      },
    },
  );

  return server;
}

/**
 * Content Registration 요청 검증
 */
function validateContentRegistrationRequest(
  request: Blockchain.SubmitContentRegistrationProofRequest,
): string | null {
  if (!request.jobId) {
    return "job_id is required";
  }

  if (request.registrationId <= 0) {
    return "registration_id must be greater than 0";
  }

  if (!request.proof) {
    return "proof is required";
  }

  if (
    !request.publicSignals ||
    request.publicSignals.length === 0
  ) {
    return "public_signals is required";
  }

  return null;
}

/**
 * Trade Approval 요청 검증
 */
function validateTradeApprovalRequest(
  request: Blockchain.SubmitTradeApprovalProofRequest,
): string | null {
  if (!request.jobId) {
    return "job_id is required";
  }

  if (request.purchaseId <= 0) {
    return "purchase_id must be greater than 0";
  }

  if (!request.proof) {
    return "proof is required";
  }

  if (
    !request.publicSignals ||
    request.publicSignals.length === 0
  ) {
    return "public_signals is required";
  }

  return null;
}

/**
 * Error → string
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}