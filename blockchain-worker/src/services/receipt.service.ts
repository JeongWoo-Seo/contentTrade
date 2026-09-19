import { prisma } from "../lib/prisma.js";
import { checkContentRegistrationReceipt, checkTradeApprovalReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import type { OutboxJobType } from "@prisma/client";

/**
 * RECEIPT_CHECK_REQUESTED 이벤트 처리.
 * SUBMITTED job의 receipt를 확인하여 CONFIRMED(+outbox) 또는 FAILED(타임아웃)로 전이한다.
 */
export async function processReceiptCheck(
  jobId: string,
  jobType: OutboxJobType,
): Promise<void> {
  if (jobType === "CONTENT_REGISTRATION") {
    await processContentRegistrationReceipt(jobId);
  } else {
    await processTradeApprovalReceipt(jobId);
  }
}

async function processContentRegistrationReceipt(jobId: string): Promise<void> {
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") return; // idempotent

  const receipt = await checkContentRegistrationReceipt(job.txHash!);
  if (!receipt.confirmed) {
    // 아직 확정되지 않음 → 상태 유지. 재확인은 recovery worker가 담당한다.
    return;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.contentRegistrationTransaction.updateMany({
      where: { id: job.id, status: "SUBMITTED" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (updated.count === 0) return;
    await outboxRepository.create(tx, {
      jobId: job.jobId,
      jobType: "CONTENT_REGISTRATION",
      eventType: "TRANSACTION_COMPLETED",
    });
  });
  console.log(`[blockchain-worker] content registration CONFIRMED jobId=${job.jobId}`);
}

async function processTradeApprovalReceipt(jobId: string): Promise<void> {
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") return;

  const receipt = await checkTradeApprovalReceipt(job.txHash!);
  if (!receipt.confirmed) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.tradeApprovalTransaction.updateMany({
      where: { id: job.id, status: "SUBMITTED" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (updated.count === 0) return;
    await outboxRepository.create(tx, {
      jobId: job.jobId,
      jobType: "TRADE_APPROVAL",
      eventType: "TRANSACTION_COMPLETED",
    });
  });
  console.log(`[blockchain-worker] trade approval CONFIRMED jobId=${job.jobId}`);
}
