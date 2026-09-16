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

  async markSubmitted(
    id: number,
    txHash: string,
  ) {
    return prisma.tradeApprovalTransaction.update({
      where: {
        id,
      },
      data: {
        status: "SUBMITTED",
        txHash,
        submittedAt: new Date(),
      },
    });
  },

  async markFailed(
    id: number,
    reason: string,
  ) {
    return prisma.tradeApprovalTransaction.update({
      where: {
        id,
      },
      data: {
        status: "FAILED",
        failureReason: reason,
        retryCount: {
          increment: 1,
        },
      },
    });
  },
};
