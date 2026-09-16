import { prisma } from "../lib/prisma.js";

export const tradeApprovalTransactionRepository = {
  async findPending() {
    return prisma.tradeApprovalTransaction.findFirst({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  async findSubmitted() {
    return prisma.tradeApprovalTransaction.findFirst({
      where: {
        status: "SUBMITTED",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  async findByJobId(jobId: string) {
    return prisma.tradeApprovalTransaction.findUnique({
      where: {
        jobId,
      },
    });
  },

  async create(data: {
    jobId: string;
    purchaseId: number;
    proof: string;
    publicSignals: string[];
  }) {
    return prisma.tradeApprovalTransaction.create({
      data: {
        jobId: data.jobId,
        purchaseId: data.purchaseId,
        proof: data.proof,
        publicSignals: JSON.stringify(data.publicSignals),
        status: "PENDING",
      },
    });
  },

  async markSubmitted(
    id: number,
    txHash: string,
  ) {
    return prisma.tradeApprovalTransaction.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        txHash,
        submittedAt: new Date(),
      },
    });
  },

  async markConfirmed(id: number) {
    return prisma.tradeApprovalTransaction.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
  },

  async markFailed(
    id: number,
    reason: string,
  ) {
    return prisma.tradeApprovalTransaction.update({
      where: { id },
      data: {
        status: "FAILED",
        failureReason: reason,
        retryCount: {
          increment: 1,
        },
      },
    });
  },

  async delete(id: number) { 
    return prisma.tradeApprovalTransaction.delete({ 
      where: { id, }, 
    }); 
  },
};