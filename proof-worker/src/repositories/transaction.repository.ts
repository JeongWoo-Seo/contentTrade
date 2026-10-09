import { prisma } from "../lib/prisma.js";
import { ContentRegistrationProofResult } from "../service/transaction.service.js";

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

  async createTradeApproval(data: CreateTradeApprovalInput) {
    return prisma.tradeApprovalTransaction.create({
      data: {
        jobId: data.jobId,
        purchaseId: data.purchaseId,
        proof: data.proof,
        publicSignals: data.publicSignals,
        status: "PENDING",
      },
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
};
