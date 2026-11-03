import { prisma } from "../lib/prisma.js";
import { outboxRepository } from "./outbox.repository.js";
import type { TransactionOutbox, ContentRegistrationTransaction, TradeApprovalTransaction } from "@prisma/client";
import { type AccountRegistrationRequestMessage } from "../kafka/types.js";

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
        job: {
            id: number;
            jobId: string;
            registrationId: number;
        },
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
                },
            });

            // 이미 다른 워커가 처리했거나 상태가 변경된 경우
            if (updated.count === 0) {
                return false;
            }

            // 2. 실패 이력 저장
            await tx.jobFailure.create({
                data: {
                    jobId: job.jobId,
                    jobType: "CONTENT_REGISTRATION",
                    referenceId: job.registrationId,
                    failureReason,
                },
            });

            // 3. 실패 이벤트를 Outbox에 등록
            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "CONTENT_REGISTRATION",
                eventType: "TRANSACTION_FAILED",
            });

            return true;
        });
    },

    async failTradeApproval(
        job: {
            id: number;
            jobId: string;
            purchaseId: number;
        },
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
                },
            });

            // SUBMITTED 상태가 아니면 실패 처리하지 않음
            if (updated.count === 0) {
                return false;
            }

            // 실패 이력 저장
            await tx.jobFailure.create({
                data: {
                    jobId: job.jobId,
                    jobType: "TRADE_APPROVAL",
                    referenceId: job.purchaseId,
                    failureReason,
                },
            });

            // 실패 이벤트 Outbox 등록
            await outboxRepository.create(tx, {
                jobId: job.jobId,
                jobType: "TRADE_APPROVAL",
                eventType: "TRANSACTION_FAILED",
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

    accountRegistrationConfirm: async (
        jobId: string,
    ): Promise<boolean> => {
        return prisma.$transaction(async (tx) => {
            // 1. PENDING → CONFIRMED 상태 변경
            const updated = await tx.accountRegistration.updateMany({
                where: {
                    jobId,
                    status: "PENDING",
                },
                data: {
                    status: "CONFIRMED",
                    confirmedAt: new Date(),
                },
            });

            // 대상이 없거나 이미 처리된 경우
            if (updated.count === 0) {
                return false;
            }

            // 2. Outbox 이벤트 생성
            await tx.transactionOutbox.create({
                data: {
                    jobId,
                    jobType: "ACCOUNT_REGISTRATION",
                    eventType: "ACCOUNT_REGISTRATION_RESULT",
                    status: "PENDING",
                },
            });

            return true;
        });
    },

    async accountRegistratioFail(
        jobId: string,
        failureReason: string,
    ): Promise<boolean> {
        return prisma.$transaction(async (tx) => {
            // 1. CHECKING → FAILED 상태 변경
            const updated = await tx.accountRegistration.updateMany({
                where: {
                    jobId,
                    status: "CHECKING",
                },
                data: {
                    status: "FAILED",
                },
            });

            // 이미 처리됐거나 대상이 없는 경우
            if (updated.count === 0) {
                return false;
            }

            // 2. 계좌 등록 작업 조회
            const job = await tx.accountRegistration.findUnique({
                where: {
                    jobId,
                },
                select: {
                    userId: true,
                },
            });

            if (!job) {
                throw new Error(`Account registration job not found: jobId=${jobId}`);
            }

            // 3. 실패 이력 저장
            await tx.jobFailure.create({
                data: {
                    jobId,
                    jobType: "ACCOUNT_REGISTRATION",
                    referenceId: job.userId,
                    failureReason,
                },
            });

            // 4. 실패 결과 Outbox 등록
            await outboxRepository.create(tx, {
                jobId,
                jobType: "ACCOUNT_REGISTRATION",
                eventType: "ACCOUNT_REGISTRATION_RESULT",
            });

            return true;
        });
    },
}
