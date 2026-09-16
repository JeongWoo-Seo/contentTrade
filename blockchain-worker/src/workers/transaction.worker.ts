import { simulateAndSubmitContentRegistration, simulateAndSubmitTradeApproval } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { sendBlockchainFailed } from "../kafka/producer.js";
import { env } from "../config/env.js";
import type { JobFailedMessage } from "../kafka/types.js";

export class TransactionWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;

    console.log("[blockchain-worker] transaction worker started");

    while (this.running) {
      try {
        await this.processContentRegistration();
        await this.processTradeApproval();
      } catch (error) {
        console.error("[blockchain-worker] transaction worker error:", error);
      }

      await this.sleep();
    }

    console.log("[blockchain-worker] transaction worker stopped");
  }

  stop(): void {
    this.running = false;
  }

  private async sleep(): Promise<void> {
    await new Promise<void>((resolve) =>
      setTimeout(
        resolve,
        env.transactionWorkerIntervalMs,
      ),
    );
  }

  /**
   * 소설 등록 블록체인 작업 처리
   */
  private async processContentRegistration(): Promise<void> {
    const job = await contentRegistrationTransactionRepository.findPending();
    if (!job) {
      return;
    }

    console.log(`[blockchain-worker] processing content registration jobId=${job.jobId}`);

    try {
      const result = await simulateAndSubmitContentRegistration({
        jobId: job.jobId,
        proof: job.proof,
        publicSignals: JSON.parse(
          job.publicSignals,
        ) as string[],
      });

      if (result.success && result.txHash) {
        await contentRegistrationTransactionRepository.markSubmitted(
          job.id,
          result.txHash,
        );

        console.log(`[blockchain-worker] content registration SUBMITTED jobId=${job.jobId}`);

        return;
      }

      const reason = result.reason ?? "transaction simulation failed";

      await this.handleContentRegistrationFailure(
        job,
        reason,
      );
    } catch (error) {
      const reason = this.getErrorMessage(error);

      console.error(`[blockchain-worker] content registration failed jobId=${job.jobId}:`, error);

      await this.handleContentRegistrationFailure(
        job,
        reason,
      );
    }
  }

  /**
   * 거래 승인 블록체인 작업 처리
   */
  private async processTradeApproval(): Promise<void> {
    const job =
      await tradeApprovalTransactionRepository.findPending();

    if (!job) {
      return;
    }

    console.log(
      `[blockchain-worker] processing trade approval jobId=${job.jobId}`,
    );

    try {
      const result = await simulateAndSubmitTradeApproval({
        jobId: job.jobId,
        proof: job.proof,
        publicSignals: JSON.parse(
          job.publicSignals,
        ) as string[],
      });

      if (result.success && result.txHash) {
        await tradeApprovalTransactionRepository.markSubmitted(
          job.id,
          result.txHash,
        );

        console.log(`[blockchain-worker] trade approval SUBMITTED jobId=${job.jobId}`);

        return;
      }

      const reason = result.reason ?? "transaction simulation failed";

      await this.handleTradeApprovalFailure(
        job,
        reason,
      );
    } catch (error) {
      const reason = this.getErrorMessage(error);

      console.error(`[blockchain-worker] trade approval failed jobId=${job.jobId}:`, error);

      await this.handleTradeApprovalFailure(
        job,
        reason,
      );
    }
  }

  /**
   * 소설 등록 실패 처리
   */
  private async handleContentRegistrationFailure(
    job: Awaited<ReturnType<typeof contentRegistrationTransactionRepository.findPending>>,
    reason: string,
  ): Promise<void> {
    if (!job) {
      return;
    }

    await contentRegistrationTransactionRepository.markFailed(
      job.id,
      reason,
    );

    await this.reportFailure({
      jobId: job.jobId,
      requestedAt: job.createdAt.toISOString(),
      failedStage: "BLOCKCHAIN",
      reason,
      proofType: "CONTENT_REGISTRATION",
      registrationId: job.registrationId,
    });
  }

  /**
   * 거래 승인 실패 처리
   */
  private async handleTradeApprovalFailure(
    job: Awaited<ReturnType<typeof tradeApprovalTransactionRepository.findPending>>,
    reason: string,
  ): Promise<void> {
    if (!job) {
      return;
    }

    await tradeApprovalTransactionRepository.markFailed(
      job.id,
      reason,
    );

    await this.reportFailure({
      jobId: job.jobId,
      requestedAt: job.createdAt.toISOString(),
      failedStage: "BLOCKCHAIN",
      reason,
      proofType: "TRADE_APPROVAL",
      purchaseId: job.purchaseId,
    });
  }

  /**
   * Blockchain 실패 이벤트 Kafka 전송
   */
  private async reportFailure(
    message: JobFailedMessage,
  ): Promise<void> {
    try {
      await sendBlockchainFailed(message);
    } catch (error) {
      console.error("[blockchain-worker] failed to send Kafka failure message:",error);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}