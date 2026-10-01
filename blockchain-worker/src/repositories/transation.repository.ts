import { prisma } from "../lib/prisma.js";
import type { TransactionOutbox } from "@prisma/client";
import { outboxRepository } from "./outbox.repository.js";
import type { ContentRegistrationTransaction, TradeApprovalTransaction } from "@prisma/client";


export const transactionRepository = {
    async markTransactionFailedProcessed(
        outbox: TransactionOutbox,
    ): Promise<void> {
        await prisma.$transaction(async (tx) => {
            if (outbox.jobType === "CONTENT_REGISTRATION") {
                await tx.contentRegistrationTransaction.delete({
                    where: {
                        jobId: outbox.jobId,
                    },
                });
            } else if (outbox.jobType === "TRADE_APPROVAL") {
                await tx.tradeApprovalTransaction.delete({
                    where: {
                        jobId: outbox.jobId,
                    },
                });
            } else {
                throw new Error(`Unsupported outbox job type: ${outbox.jobType}`);
            }

            await tx.transactionOutbox.update({
                where: {
                    id: outbox.id,
                },
                data: {
                    status: "PUBLISHED",
                    publishedAt: new Date(),
                },
            });
        });
    },

    async failContentRegistration(
        job: ContentRegistrationTransaction,
        failureReason: string,
    ): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.contentRegistrationTransaction.updateMany({
                where: {
                    id: job.id,
                    status: "SUBMITTED",
                },
                data: {
                    status: "FAILED",
                    failureReason,
                },
            });

            if (updated.count === 0) {
                return false;
            }

            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "CONTENT_REGISTRATION",
                eventType: "TRANSACTION_FAILED",
                registrationId: job.registrationId,
                requestedAt: job.createdAt,
                failedStage: "BLOCKCHAIN",
                failReason: failureReason,
            });

            return true;
        });
    },

    async failTradeApproval(
        job: TradeApprovalTransaction,
        failureReason: string,
    ): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.tradeApprovalTransaction.updateMany({
                where: {
                    id: job.id,
                    status: "SUBMITTED",
                },
                data: {
                    status: "FAILED",
                    failureReason,
                },
            });

            if (updated.count === 0) {
                return false;
            }

            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "TRADE_APPROVAL",
                eventType: "TRANSACTION_FAILED",
                purchaseId: job.purchaseId,
                requestedAt: job.createdAt,
                failedStage: "BLOCKCHAIN",
                failReason: failureReason,
            });

            return true;
        });
    },

    async confirmContentRegistration(
        job: ContentRegistrationTransaction,
    ): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.contentRegistrationTransaction.updateMany({
                where: {
                    id: job.id,
                    status: "SUBMITTED",
                },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
            });

            if (updated.count === 0) {
                return false;
            }

            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "CONTENT_REGISTRATION",
                eventType: "TRANSACTION_COMPLETED",
            });

            return true;
        });
    },

    async confirmTradeApproval(
        job: TradeApprovalTransaction,
    ): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            const updated = await tx.tradeApprovalTransaction.updateMany({
                where: {
                    id: job.id,
                    status: "SUBMITTED",
                },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
            });

            if (updated.count === 0) {
                return false;
            }

            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "TRADE_APPROVAL",
                eventType: "TRANSACTION_COMPLETED",
            });

            return true;
        });
    },

}