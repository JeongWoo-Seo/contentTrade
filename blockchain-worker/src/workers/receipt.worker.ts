import { checkContentRegistrationReceipt, checkTradeApprovalReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { env } from "../config/env.js";

export class ReceiptWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;

    console.log("[blockchain-worker] receipt worker started");

    while (this.running) {
      try {
        await this.processContentRegistration();
        await this.processTradeApproval();
      } catch (error) {
        console.error("[blockchain-worker] receipt worker error:", error);
      }

      await this.sleep();
    }

    console.log("[blockchain-worker] receipt worker stopped");
  }

  stop(): void {
    this.running = false;
  }

  private async sleep(): Promise<void> {
    await new Promise<void>((resolve) =>
      setTimeout(
        resolve,
        env.receiptWorkerIntervalMs,
      ),
    );
  }

  /**
   * 소설 등록 TX receipt 확인
   */
  private async processContentRegistration(): Promise<void> {
    const job = await contentRegistrationTransactionRepository.findSubmitted();
    if (!job) {
      return;
    }

    console.log(`[blockchain-worker] checking content registration receipt jobId=${job.jobId}`);

    try {
      const receipt = await checkContentRegistrationReceipt(job.txHash!);
      if (!receipt.confirmed) {
        return;
      }

      await contentRegistrationTransactionRepository.markConfirmed(job.id);

    } catch (error) {
      console.error(`[blockchain-worker] content registration receipt check failed jobId=${job.jobId}:`, error);
    }
  }

  /**
   * 거래 승인 TX receipt 확인
   */
  private async processTradeApproval(): Promise<void> {
    const job = await tradeApprovalTransactionRepository.findSubmitted();
    if (!job) {
      return;
    }

    console.log(`[blockchain-worker] checking trade approval receipt jobId=${job.jobId}`);

    try {
      const receipt = await checkTradeApprovalReceipt(job.txHash!);
      if (!receipt.confirmed) {
        return;
      }

      await tradeApprovalTransactionRepository.markConfirmed(job.id);

      /**
       * TODO:
       * Market CompleteTradeApproval gRPC 추가 후
       * 여기서 Market에 완료 결과를 전달한다.
       */

      console.log(`[blockchain-worker] trade approval CONFIRMED jobId=${job.jobId}`);
    } catch (error) {
      console.error(`[blockchain-worker] trade approval receipt check failed jobId=${job.jobId}:`, error);
    }
  }
}