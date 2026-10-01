import { prisma } from "../lib/prisma.js";
import type { TransactionOutbox, OutboxEventType } from "@prisma/client";

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

  async findSubmitted() {
    return prisma.contentRegistrationTransaction.findFirst({
      where: {
        status: "SUBMITTED",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  async findConfirmed() {
    return prisma.contentRegistrationTransaction.findFirst({
      where: { status: "CONFIRMED" },
      orderBy: { createdAt: "asc" },
    });
  },

  async findFailed() {
    return prisma.contentRegistrationTransaction.findFirst({
      where: { status: "FAILED" },
      orderBy: { createdAt: "asc" },
    });
  },

  async findByJobId(jobId: string) {
    return prisma.contentRegistrationTransaction.findUnique({
      where: {
        jobId,
      },
    });
  },

  async markSubmitted(
    id: number,
    txHash: string,
  ) {
    return prisma.contentRegistrationTransaction.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        txHash,
        submittedAt: new Date(),
      },
    });
  },

  async markConfirmed(id: number) {
    return prisma.contentRegistrationTransaction.update({
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
    return prisma.contentRegistrationTransaction.update({
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
    return prisma.contentRegistrationTransaction.delete({
      where: { id, },
    });
  },
};