import { prisma } from "../lib/prisma.js";
import { checkContentRegistrationReceipt, checkTradeApprovalReceipt } from "../blockchain/blockchain.service.js";
import { contentRegistrationTransactionRepository } from "../repositories/content-registration.repository.js";
import { tradeApprovalTransactionRepository } from "../repositories/trade-approval.repository.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import type { OutboxJobType } from "@prisma/client";

/**
 * RECEIPT_CHECK_REQUESTED 이벤트 처리.
 * SUBMITTED job의 receipt를 확인하여 CONFIRMED(+outbox) 또는 FAILED(타임아웃)로 전이한다.
 * receipt worker는 상태 확인하는 과정만 하지 때문에 status를 proseccing 으로 변경하지 않는다.
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

async function processContentRegistrationReceipt(
  jobId: string,
): Promise<void> {
  const job = await contentRegistrationTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const receipt = await checkContentRegistrationReceipt(job.txHash!);

  // 아직 pending
  if (!receipt.confirmed && !receipt.failed) {
    return;
  }

  // 블록체인 실행 실패
  if (receipt.failed) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.contentRegistrationTransaction.updateMany({
          where: {
            id: job.id,
            status: "SUBMITTED",
          },
          data: {
            status: "FAILED",
            failureReason: `Transaction reverted (status=${receipt.status})`,
          },
        });

      if (updated.count === 0) return;

      await outboxRepository.create(tx, {
        jobId: job.jobId,
        jobType: "CONTENT_REGISTRATION",
        eventType: "TRANSACTION_FAILED",
      });
    });

    console.error(
      `[blockchain-worker] content registration FAILED ` +
        `jobId=${job.jobId} txHash=${receipt.transactionHash}`,
    );

    return;
  }

  // 성공
  await prisma.$transaction(async (tx) => {
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

    if (updated.count === 0) return;

    await outboxRepository.create(tx, {
      jobId: job.jobId,
      jobType: "CONTENT_REGISTRATION",
      eventType: "TRANSACTION_COMPLETED",
    });
  });

  console.log(
    `[blockchain-worker] content registration CONFIRMED ` +
      `jobId=${job.jobId}`,
  );
}

async function processTradeApprovalReceipt(jobId: string): Promise<void> {
  const job = await tradeApprovalTransactionRepository.findByJobId(jobId);
  if (!job || job.status !== "SUBMITTED") {
    return;
  }

  const receipt = await checkTradeApprovalReceipt(job.txHash!);

  // 아직 블록에 포함되지 않음
  if (!receipt.confirmed && !receipt.failed) {
    return;
  }

  // 블록체인 실행 실패
  if (receipt.failed) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.tradeApprovalTransaction.updateMany({
        where: {
          id: job.id,
          status: "SUBMITTED",
        },
        data: {
          status: "FAILED",
          failureReason: `Transaction reverted (status=${receipt.status})`,
        },
      });

      if (updated.count === 0) {
        return;
      }

      await outboxRepository.create(tx, {
        jobId: job.jobId,
        jobType: "TRADE_APPROVAL",
        eventType: "TRANSACTION_FAILED",
      });
    });

    console.error(
      `[blockchain-worker] trade approval FAILED ` +
        `jobId=${job.jobId} txHash=${receipt.transactionHash}`,
    );

    return;
  }

  // 블록체인 실행 성공
  await prisma.$transaction(async (tx) => {
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
      return;
    }

    await outboxRepository.create(tx, {
      jobId: job.jobId,
      jobType: "TRADE_APPROVAL",
      eventType: "TRANSACTION_COMPLETED",
    });
  });

  console.log(
    `[blockchain-worker] trade approval CONFIRMED jobId=${job.jobId}`,
  );
}