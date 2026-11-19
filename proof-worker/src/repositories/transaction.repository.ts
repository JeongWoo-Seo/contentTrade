import { prisma } from "../lib/prisma.js";
import { ContentRegistrationProofResult } from "../service/proof.service.js";
import { type ProofRequestedMessage } from "../kafka/types.js";

export interface CreateContentRegistrationInput {
  jobId: string;
  registrationId: number;
  ContentRegistrationProof: ContentRegistrationProofResult;
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

          status: "PROOF_COMPLETED",
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

  async findContentRegistrationByJobId(jobId: string) {
    return prisma.contentRegistrationTransaction.findUnique({
      where: { jobId },
    });
  },

  // 거래 승인 작업 조회 (referenceId = purchaseId)
  async findTradeApprovalByPurchaseId(purchaseId: number) {
    return prisma.tradeApprovalTransaction.findUnique({
      where: { purchaseId },
    });
  },

  // 거래 승인 작업 선점 (approvalJobId null + status PENDING일 때만)
  async claimTradeApproval(purchaseId: number, jobId: string): Promise<boolean> {
    const result = await prisma.tradeApprovalTransaction.updateMany({
      where: {
        purchaseId,
        approvalJobId: null,
        status: "PENDING",
      },
      data: {
        approvalJobId: jobId,
      },
    });

    return result.count === 1;
  },

  // 거래 승인 결과 저장 + Transaction Worker용 Outbox 생성 (원자적)
  async saveTradeApprovalWithOutbox(data: {
    purchaseId: number;
    jobId: string;
    proof: string;
    publicSignals: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.tradeApprovalTransaction.update({
        where: { purchaseId: data.purchaseId },
        data: {
          approvalJobId: data.jobId,
          proof: data.proof,
          publicSignals: data.publicSignals,
          status: "PROOF_COMPLETED",
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
