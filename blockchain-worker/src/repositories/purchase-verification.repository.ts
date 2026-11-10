import { prisma } from "../lib/prisma.js";
import { outboxRepository } from "./outbox.repository.js";
import { PurchaseReceiptCheckResult } from "../blockchain/type.js";

export const purchaseVerificationRepository = {
  async findByJobId(jobId: string) {
    return prisma.purchaseVerification.findUnique({ where: { jobId } });
  },

  /**
   * 구매 요청 확인 작업을 조회/생성한다. retry용 입력(txHash)과
   * Receipt 확인 상태(status)를 보관한다.
   */
  async claimOrCreatePendingReceipt(message: {
    jobId: string;
    txHash: string;
    referenceId: number;
  }) {
    return prisma.$transaction(async (tx) => {
      let job = await tx.purchaseVerification.findUnique({
        where: { jobId: message.jobId },
      });

      if (!job) {
        job = await tx.purchaseVerification.create({
          data: {
            jobId: message.jobId,
            txHash: message.txHash,
            referenceId: message.referenceId,
            status: "PENDING",
          },
        });
      }

      return job;
    });
  },

  /**
   * PENDING → CONFIRMED 전이 + 결과 전달용 Outbox(PURCHASE_VERIFICATION_RESULT) 생성.
   * 이미 처리된 경우(중복 메시지)에는 no-op(false).
   */
  async confirm(
    jobId: string,
    result: Extract<PurchaseReceiptCheckResult, { status: "CONFIRMED" }>
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      // 1. PENDING → CONFIRMED 전이
      const updated = await tx.purchaseVerification.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      if (updated.count === 0) {
        return false;
      }

      // 2. purchaseId(referenceId) 조회
      const verification = await tx.purchaseVerification.findUnique({
        where: { jobId },
        select: { referenceId: true },
      });

      if (!verification) {
        throw new Error(`Purchase verification job not found: jobId=${jobId}`);
      }

      // 3. TradeApprovalTransaction 생성 (승인 트랜잭션 생성 전 stub)
      await tx.tradeApprovalTransaction.create({
        data: {
          jobId,
          purchaseId: verification.referenceId,
          tradeData: JSON.stringify(result.tradeData),
          status: "PENDING",
        },
      });

      // 4. 결과 전달용 Outbox 생성
      await outboxRepository.create(tx, {
        jobId,
        jobType: "PURCHASE_VERIFICATION",
        eventType: "PURCHASE_VERIFICATION_RESULT",
      });

      return true;
    });
  },

  /**
   * PENDING → FAILED 전이 + 실패 이력 + 결과 Outbox(PURCHASE_VERIFICATION_RESULT) 생성.
   * 이미 처리된 경우(중복 메시지)에는 no-op(false).
   */
  async fail(jobId: string, failureReason: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseVerification.updateMany({
        where: { jobId, status: "PENDING" },
        data: { status: "FAILED" },
      });

      if (updated.count === 0) {
        return false;
      }

      const job = await tx.purchaseVerification.findUnique({
        where: { jobId },
        select: { referenceId: true },
      });

      if (!job) {
        throw new Error(`Purchase verification job not found: jobId=${jobId}`);
      }

      await tx.jobFailure.create({
        data: {
          jobId,
          jobType: "PURCHASE_VERIFICATION",
          referenceId: job.referenceId,
          failureReason,
        },
      });

      await outboxRepository.create(tx, {
        jobId,
        jobType: "PURCHASE_VERIFICATION",
        eventType: "PURCHASE_VERIFICATION_RESULT",
      });

      return true;
    });
  },
};
