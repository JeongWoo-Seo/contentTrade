import { env } from "../config/env.js";
import type { JobFailedMessage } from "../kafka/types.js";
import { sendBlockchainFailed } from "../kafka/producer.js";
import { completeContentRegistration } from "../grpc/market.client.js";
import { Market } from "@content-trade/grpc-contract";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";

export class ResultSendWorker {
    private running = false;

    async start(): Promise<void> {
        this.running = true;

        console.log("[blockchain-worker] result send worker started");

        while (this.running) {
            try {
                // 블록체인 성공 결과 전달
                await this.processContentRegistrationSuccess();
                await this.processTradeApprovalSuccess();

                // 블록체인 실패 결과 전달
                await this.processContentRegistrationFailure();
                await this.processTradeApprovalFailure();
            } catch (error) {
                console.error("[blockchain-worker] result send worker error:", error);
            }

            await this.sleep();
        }

        console.log("[blockchain-worker] result send worker stopped");
    }

    stop(): void {
        this.running = false;
    }

    private async sleep(): Promise<void> {
        await new Promise<void>((resolve) =>
            setTimeout(resolve, env.resultSendWorkerIntervalMs),
        );
    }
    
    /**
     * CONFIRMED 상태의 소설 등록 작업을 Market에 전달
     */
    private async processContentRegistrationSuccess(): Promise<void> {
        const job = await contentRegistrationTransactionRepository.findConfirmed();
        if (!job) {
            return;
        }

        console.log(
            `[blockchain-worker] sending content registration result ` +
            `jobId=${job.jobId}`,
        );

        try {
            const request: Market.CompleteContentRegistrationRequest = {
                jobId: job.jobId,
                registrationId: job.registrationId,

                encryptedData: job.encryptedData,
                dataIv: job.dataIv,
                encryptedDataKey: job.encryptedDataKey,
                keyIv: job.keyIv,
                keyAuthTag: job.keyAuthTag,
                encryptionVersion: job.encryptionVersion,

                keyHash: job.keyHash,
                encryptedDataHash: job.encryptedDataHash,
                contentHash: job.contentHash,

                txHash: job.txHash ?? "",
            };

            await completeContentRegistration(request);

            // Market 전달 성공 후에만 삭제
            await contentRegistrationTransactionRepository.delete(job.id);

            console.log(
                `[blockchain-worker] content registration result sent ` +
                `jobId=${job.jobId}`,
            );
        } catch (error) {
            // DB 상태는 CONFIRMED 그대로 유지
            // 다음 polling에서 다시 전송
            console.error(
                `[blockchain-worker] failed to send content registration result ` +
                `jobId=${job.jobId}:`,
                error,
            );
        }
    }

    /**
     * CONFIRMED 상태의 거래 승인 작업을 Market에 전달
     */
    private async processTradeApprovalSuccess(): Promise<void> {
        const job = await tradeApprovalTransactionRepository.findConfirmed();
        if (!job) {
            return;
        }

        console.log(
            `[blockchain-worker] sending trade approval result ` +
            `jobId=${job.jobId}`,
        );

        try {
            // TODO:
            // Market의 거래 승인 완료 gRPC 호출
            //
            // await completeTradeApproval({
            //   jobId: job.jobId,
            //   purchaseId: job.purchaseId,
            //   txHash: job.txHash ?? "",
            // });

            // gRPC 성공 후 삭제
            await tradeApprovalTransactionRepository.delete(job.id);

            console.log(
                `[blockchain-worker] trade approval result sent ` +
                `jobId=${job.jobId}`,
            );
        } catch (error) {
            // CONFIRMED 상태 유지
            console.error(
                `[blockchain-worker] failed to send trade approval result ` +
                `jobId=${job.jobId}:`,
                error,
            );
        }
    }

    /**
     * FAILED 상태의 소설 등록 작업을 Kafka로 전달
     */
    private async processContentRegistrationFailure(): Promise<void> {
        const job = await contentRegistrationTransactionRepository.findFailed();
        if (!job) {
            return;
        }

        console.log(
            `[blockchain-worker] sending content registration failure ` +
            `jobId=${job.jobId}`,
        );

        try {
            await this.reportFailure({
                jobId: job.jobId,
                requestedAt: job.createdAt.toISOString(),
                failedStage: "BLOCKCHAIN",
                reason: job.failureReason ?? "blockchain transaction failed",
                proofType: "CONTENT_REGISTRATION",
                registrationId: job.registrationId,
            });

            // Kafka 전송 성공 후에만 삭제
            await contentRegistrationTransactionRepository.delete(job.id);

            console.log(
                `[blockchain-worker] content registration failure sent ` +
                `jobId=${job.jobId}`,
            );
        } catch (error) {
            // FAILED 상태 유지
            // 다음 polling에서 다시 Kafka 전송
            console.error(
                `[blockchain-worker] failed to send content registration failure ` +
                `jobId=${job.jobId}:`,
                error,
            );
        }
    }

    /**
     * FAILED 상태의 거래 승인 작업을 Kafka로 전달
     */
    private async processTradeApprovalFailure(): Promise<void> {
        const job = await tradeApprovalTransactionRepository.findFailed();
        if (!job) {
            return;
        }

        console.log(
            `[blockchain-worker] sending trade approval failure ` +
            `jobId=${job.jobId}`,
        );

        try {
            await this.reportFailure({
                jobId: job.jobId,
                requestedAt: job.createdAt.toISOString(),
                failedStage: "BLOCKCHAIN",
                reason: job.failureReason ?? "blockchain transaction failed",
                proofType: "TRADE_APPROVAL",
                purchaseId: job.purchaseId,
            });

            // Kafka 전송 성공 후에만 삭제
            await tradeApprovalTransactionRepository.delete(job.id);

            console.log(
                `[blockchain-worker] trade approval failure sent ` +
                `jobId=${job.jobId}`,
            );
        } catch (error) {
            // FAILED 상태 유지
            console.error(
                `[blockchain-worker] failed to send trade approval failure ` +
                `jobId=${job.jobId}:`,
                error,
            );
        }
    }

    /**
     * Blockchain 실패 이벤트 Kafka 전송
     */
    private async reportFailure(
        message: JobFailedMessage,
    ): Promise<void> {
        await sendBlockchainFailed(message);
    }
}