import { prisma } from "../lib/prisma.js";

export const contentRegistrationTransactionRepository = {
  async findPending() {
    return prisma.contentRegistrationTransaction.findFirst({
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
    return prisma.contentRegistrationTransaction.update({
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
    return prisma.contentRegistrationTransaction.update({
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
