import { simulateAndSubmitContentRegistration, simulateAndSubmitTradeApproval } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { env } from "../config/env.js";


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

    try {
      const result = await simulateAndSubmitContentRegistration({
        jobId: job.jobId,
        proof: job.proof,
        publicSignals: JSON.parse(job.publicSignals) as string[],
      });

      if (result.result == "SUCCESS") {
        await contentRegistrationTransactionRepository.markSubmitted(
          job.id,
          result.txHash,
        );

        return;
      }

      if (result.result === "PROOF_INVALID") {
        await contentRegistrationTransactionRepository.markFailed(
          job.id,
          result.reason,
        );

        return;
      }

      if (result.result === "RPC_ERROR") {
        console.error(
          `[blockchain-worker] blockchain communication failed ` +
          `jobId=${job.jobId}: ${result.reason}`,
        );
        return
      }
    } catch (error) {
      // 예상하지 못한 RPC/network 오류도 재시도
      console.error(
        `[blockchain-worker] unexpected blockchain error ` +
        `jobId=${job.jobId}:`,
        error,
      );
    }
  }

  /**
   * 거래 승인 블록체인 작업 처리
   */
  private async processTradeApproval(): Promise<void> {
    const job = await tradeApprovalTransactionRepository.findPending();
    if (!job) {
      return;
    }

    console.log(`[blockchain-worker] processing trade approval jobId=${job.jobId}`);

    try {
      const result = await simulateAndSubmitTradeApproval({
        jobId: job.jobId,
        proof: job.proof,
        publicSignals: JSON.parse(job.publicSignals) as string[],
      });

      // 블록체인 TX 제출 성공
      if (result.result === "SUCCESS") {
        await tradeApprovalTransactionRepository.markSubmitted(
          job.id,
          result.txHash,
        );

        console.log(`[blockchain-worker] trade approval SUBMITTED jobId=${job.jobId}`)
        return;
      }

      // Proof 검증 실패
      if (result.result === "PROOF_INVALID") {
        await tradeApprovalTransactionRepository.markFailed(
          job.id,
          result.reason,
        );

        console.error(`[blockchain-worker] trade approval FAILED jobId=${job.jobId}: ${result.reason}`);
        return;
      }

      // RPC / 네트워크 오류
      // 상태를 변경하지 않고 다음 polling에서 재시도
      if (result.result === "RPC_ERROR") {
        console.error(`[blockchain-worker] trade approval RPC error jobId=${job.jobId}: ${result.reason}`);
        return;
      }
    } catch (error) {
      // 예상하지 못한 오류도 일단 DB 상태를 변경하지 않고 재시도
      console.error(`[blockchain-worker] unexpected trade approval error jobId=${job.jobId}:`,error);

      return;
    }
  }
}