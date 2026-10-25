import { prisma } from "../lib/prisma.js";
import type {
  FailedStage,
  OutboxEventType,
  OutboxJobType,
  Prisma,
} from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface OutboxCreateInput {
  jobId: string;
  jobType: OutboxJobType;
  eventType: OutboxEventType;
  registrationId?: number | null;
  purchaseId?: number | null;
  requestedAt?: Date | null;
  failedStage?: FailedStage | null;
  failReason?: string | null;
}

export const outboxRepository = {
  /**
   * Outbox 레코드 생성. 반드시 DB 상태 변경과 같은 transaction 안에서 호출한다.
   * 실패 이벤트(TRANSACTION_FAILED)는 실패 메시지 생성에 필요한 데이터를 함께 저장한다.
   */
  async create(tx: DbClient, data: OutboxCreateInput) {
    return tx.transactionOutbox.create({
      data: {
        jobId: data.jobId,
        jobType: data.jobType,
        eventType: data.eventType,
        registrationId: data.registrationId ?? null,
        purchaseId: data.purchaseId ?? null,
        requestedAt: data.requestedAt ?? null,
        failedStage: data.failedStage ?? null,
        failReason: data.failReason ?? null,
        status: "PENDING",
      },
    });
  },

  /**
   * PENDING Outbox 하나를 조회한다. (Outbox Worker는 단일 인스턴스로 동작)
   */
  async findNextPending() {
    return prisma.transactionOutbox.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
  },

  async markPublished(id: number) {
    return prisma.transactionOutbox.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  },

  /**
   * publish 실패 시 재시도 횟수 증가 + 마지막 오류 기록.
   * status는 PENDING으로 유지하여 재시도한다.
   */
  async markPublishFailed(id: number, error: string) {
    return prisma.transactionOutbox.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        lastError: error,
      },
    });
  },
  /**
   * Receipt 재확인을 위해 해당 job의 RECEIPT_CHECK_REQUESTED Outbox를 PENDING으로 되돌린다.
   * Outbox worker가 다음 poll에서 확인 메시지를 재발행한다.
   * 이미 PENDING이어도 안전(no-op)하며 publishedAt을 초기화한다.
   */
  async markPendingForReceiptRetry(jobId: string) {
    return prisma.transactionOutbox.updateMany({
      where: { jobId, eventType: "RECEIPT_CHECK_REQUESTED" },
      data: { status: "PENDING", publishedAt: null },
    });
  },

  /**
   * Recovery용: 중복 허용(이미 존재하면 skip)으로 Outbox를 생성한다.
   */
  async createManySkipDuplicates(
    rows: Array<{ jobId: string; jobType: OutboxJobType; eventType: OutboxEventType }>,
  ) {
    if (rows.length === 0) return { count: 0 };
    return prisma.transactionOutbox.createMany({
      data: rows.map((r) => ({
        jobId: r.jobId,
        jobType: r.jobType,
        eventType: r.eventType,
        status: "PENDING" as const,
      })),
      skipDuplicates: true,
    });
  },
};
