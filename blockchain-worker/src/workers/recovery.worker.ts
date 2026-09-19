import { prisma } from "../lib/prisma.js";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { env } from "../config/env.js";
import type { OutboxEventType, OutboxJobType, TransactionJobStatus } from "@prisma/client";

type OutboxRow = { jobId: string; jobType: OutboxJobType; eventType: OutboxEventType };

const STATUS_EVENT_MAP: Array<[TransactionJobStatus, OutboxEventType]> = [
  ["PENDING", "TRANSACTION_REQUESTED"],
  ["SUBMITTED", "RECEIPT_CHECK_REQUESTED"],
  ["CONFIRMED", "TRANSACTION_COMPLETED"],
  ["FAILED", "TRANSACTION_FAILED"],
];

/**
 * Recovery Worker.
 * 정상 흐름은 Redis Streams를 사용하고, 이 Worker는 예외적 장애 복구만 담당한다.
 * 각 상태의 job에 대해 다음 단계 Outbox가 없으면 재생성한다(중복은 skip).
 */
export class RecoveryWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    console.log("[blockchain-worker] recovery worker started");

    while (this.running) {
      try {
        await this.recoverMissingOutbox();
      } catch (error) {
        console.error("[blockchain-worker] recovery worker error:", error);
      }
      await this.sleep();
    }

    console.log("[blockchain-worker] recovery worker stopped");
  }

  stop(): void {
    this.running = false;
  }

  private sleep(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, env.recoveryWorkerIntervalMs));
  }

  private async recoverMissingOutbox(): Promise<void> {
    const rows: OutboxRow[] = [];

    for (const [status, eventType] of STATUS_EVENT_MAP) {
      rows.push(...(await this.collectByStatus(status, eventType)));
    }

    if (rows.length > 0) {
      const result = await outboxRepository.createManySkipDuplicates(rows);
      if (result.count > 0) {
        console.log(`[blockchain-worker] recovery created ${result.count} missing outbox records`);
      }
    }
  }

  private async collectByStatus(
    status: TransactionJobStatus,
    eventType: OutboxEventType,
  ): Promise<OutboxRow[]> {
    const content = await prisma.contentRegistrationTransaction.findMany({
      where: { status },
      select: { jobId: true },
    });
    const trade = await prisma.tradeApprovalTransaction.findMany({
      where: { status },
      select: { jobId: true },
    });

    return [
      ...content.map((j) => ({
        jobId: j.jobId,
        jobType: "CONTENT_REGISTRATION" as const,
        eventType,
      })),
      ...trade.map((j) => ({
        jobId: j.jobId,
        jobType: "TRADE_APPROVAL" as const,
        eventType,
      })),
    ];
  }
}
