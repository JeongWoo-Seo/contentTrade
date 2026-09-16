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

  async findByJobId(jobId: string) {
    return prisma.contentRegistrationTransaction.findUnique({
      where: {
        jobId,
      },
    });
  },

  async create(data: {
    jobId: string;
    registrationId: number;
    proof: string;
    publicSignals: string[];
    encryptedData: string;
    dataIv: string;
    encryptedDataKey: string;
    keyIv: string;
    keyAuthTag: string;
    encryptionVersion: number;
    keyHash: string;
    encryptedDataHash: string;
    contentHash: string;
  }) {
    return prisma.contentRegistrationTransaction.create({
      data: {
        jobId: data.jobId,
        registrationId: data.registrationId,
        proof: data.proof,
        publicSignals: JSON.stringify(data.publicSignals),

        encryptedData: data.encryptedData,
        dataIv: data.dataIv,
        encryptedDataKey: data.encryptedDataKey,
        keyIv: data.keyIv,
        keyAuthTag: data.keyAuthTag,

        encryptionVersion: data.encryptionVersion,

        keyHash: data.keyHash,
        encryptedDataHash: data.encryptedDataHash,
        contentHash: data.contentHash,

        status: "PENDING",
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