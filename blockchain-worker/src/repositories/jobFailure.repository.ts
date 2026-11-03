import { prisma } from "../lib/prisma.js";

export const jobFailureRepository = {
    async findLatestFailureByJobId(jobId: string) {
        return prisma.jobFailure.findFirst({
            where: {
                jobId,
                jobType: "ACCOUNT_REGISTRATION",
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                failureReason: true,
                referenceId: true,
            },
        });
    },
}