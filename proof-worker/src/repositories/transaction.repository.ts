import { prisma } from "../lib/prisma.js";
import { ContentRegistrationProofResult } from "../service/transaction.service.js";
import { type ProofRequestedMessage } from "../kafka/types.js";

export interface CreateContentRegistrationInput {
  jobId: string;
  registrationId: number;
  ContentRegistrationProof: ContentRegistrationProofResult;
}

export interface CreateTradeApprovalInput {
  jobId: string;
  purchaseId: number;
  proof: string;
  publicSignals: string;
}

export const transactionRepository = {
  async createContentRegistrationWithOutbox(
    data: CreateContentRegistrationInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const encryption = data.ContentRegistrationProof.encryption;

      const transaction = await tx.contentRegistrationTransaction.create({
        data: {
          jobId: data.jobId,
          registrationId: data.registrationId,

          // ZK Proof
          proof: data.ContentRegistrationProof.proof,
          publicSignals: JSON.stringify(data.ContentRegistrationProof.publicSignals),

          // 암호화 데이터 (CT_data concat + Poseidon 공개값 + 복호화 파라미터)
          encryptedData: encryption.encryptedData,
          encryptedDataKey: encryption.encryptedDataKey,
          ctR: encryption.ctR,
          encryptionVersion: encryption.encryptionVersion,
          hK: encryption.hK,
          hData: encryption.hData,
          hCt: encryption.hCt,

          status: "PENDING",
        },
      });

      await tx.transactionOutbox.create({
        data: {
          jobId: data.jobId,
          jobType: "CONTENT_REGISTRATION",
          eventType: "TRANSACTION_REQUESTED",
          status: "PENDING",
        },
      });

      return transaction;
    });
  },

  // ==========================================================
  // 거래 승인 작업 + Outbox
  // ==========================================================
  async createTradeApprovalWithOutbox(
    data: CreateTradeApprovalInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.tradeApprovalTransaction.create({
        data: {
          jobId: data.jobId,
          purchaseId: data.purchaseId,
          proof: data.proof,
          publicSignals: data.publicSignals,
          status: "PENDING",
        },
      });

      await tx.transactionOutbox.create({
        data: {
          jobId: data.jobId,
          jobType: "TRADE_APPROVAL",
          eventType: "TRANSACTION_REQUESTED",
          status: "PENDING",
        },
      });

      return transaction;
    });
  },

  async findContentRegistrationByJobId(jobId: string) {
    return prisma.contentRegistrationTransaction.findUnique({
      where: { jobId },
    });
  },

  async findTradeApprovalByJobId(jobId: string) {
    return prisma.tradeApprovalTransaction.findUnique({
      where: { jobId },
    });
  },

  async createFailureWithOutbox(
    job: ProofRequestedMessage,
    reason: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. 실패 이력 저장
      await tx.jobFailure.create({
        data: {
          jobId: job.jobId,
          jobType: job.jobType,
          referenceId: job.referenceId,
          failureReason: reason,
        },
      });

      // 2. 실패 이벤트 Outbox 등록
      await tx.transactionOutbox.upsert({
        where: {
          jobId_eventType: {
            jobId: job.jobId,
            eventType: "PROOF_FAILED",
          },
        },
        create: {
          jobId: job.jobId,
          jobType: job.jobType,
          eventType: "PROOF_FAILED",
          status: "PENDING",
        },
        update: {},
      });
    });
  },
};
