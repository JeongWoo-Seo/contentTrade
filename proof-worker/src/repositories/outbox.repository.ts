import { prisma } from "../lib/prisma.js";
import type { OutboxEventType, OutboxJobType, FailedStage } from "@prisma/client";

export const outboxRepository = {
  /**
   * Outbox 레코드 생성. jobId + eventType unique로 멱등성을 보장한다.
   */
  async create(
    data: {
      jobId: string;
      jobType: OutboxJobType;
      eventType: OutboxEventType;

      failReason?: string;
      requestedAt?: Date;
      failedStage?: FailedStage;

      registrationId?: number;
      purchaseId?: number;
    },
  ) {
    return prisma.transactionOutbox.create({
      data: {
        jobId: data.jobId,
        jobType: data.jobType,
        eventType: data.eventType,

        failReason: data.failReason,
        requestedAt: data.requestedAt,

        status: "PENDING",
      },
    });
  },
};
