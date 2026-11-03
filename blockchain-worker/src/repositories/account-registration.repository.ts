import { prisma } from "../lib/prisma.js";

export const accountRegistrationRepository = {
  async findByJobId(jobId: string) {
    return prisma.accountRegistration.findUnique({ where: { jobId } });
  },

  async claimOrCreatePendingReceipt(
        message: {
            jobId: string;
            userId: number;
            addr: string;
            txHash: string;
        }
      ){
        return prisma.$transaction(async (tx) => {
            // 1. 작업 조회
            let job = await tx.accountRegistration.findUnique({
                where: { jobId: message.jobId },
            });

            // 2. 작업이 없으면 PENDING으로 생성
            if (!job) {
                job = await tx.accountRegistration.create({
                    data: {
                        jobId: message.jobId,
                        userId: message.userId,
                        addr: message.addr,
                        txHash: message.txHash,
                        status: "PENDING",
                    },
                });
            }

            return job;
        });
    },
};
