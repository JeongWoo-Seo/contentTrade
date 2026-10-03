import { prisma } from "../lib/prisma.js";
import type { OutboxJobType, Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const outboxRepository = {
  /**
   * Outbox 레코드 생성. 반드시 등록/source 생성과 같은 transaction 안에서 호출한다.
   */
  async create(
    tx: DbClient,
    data: { jobId: string; jobType: OutboxJobType; referenceId: number },
  ) {
    return tx.outbox.create({
      data: {
        jobId: data.jobId,
        jobType: data.jobType,
        referenceId: data.referenceId,
        status: "PENDING",
      },
    });
  },

  /**
   * PENDING Outbox 하나를 조회한다. (Outbox Worker는 단일 인스턴스로 동작)
   */
  async findNextPending() {
    return prisma.outbox.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
  },

  async markPublished(id: number) {
    return prisma.outbox.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  },

  /**
   * Kafka publish 실패 시 재시도 횟수 증가 + 마지막 오류 기록.
   * status는 PENDING으로 유지하여 다음 polling에서 재처리한다.
   */
  async markPublishFailed(id: number, error: string) {
    return prisma.outbox.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        lastError: error,
      },
    });
  },
};
