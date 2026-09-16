import { Market } from "@content-trade/grpc-contract";
import { prisma } from "../lib/prisma.js";
import {
  checkContentRegistrationReceipt,
  checkTradeApprovalReceipt,
} from "../blockchain/blockchain.service.js";
import { completeContentRegistration } from "../grpc/market.client.js";
import { sendBlockchainFailed } from "../kafka/producer.js";
import { env } from "../config/env.js";
import type { JobFailedMessage } from "../kafka/types.js";

// 영수증 확인 타임아웃 (5분). createdAt 기준.
const RECEIPT_TIMEOUT_MS = 5 * 60 * 1000;

type ContentRegistrationOutcome =
  | null
  | { kind: "failed"; message: JobFailedMessage }
  | { kind: "confirmed"; request: Market.CompleteContentRegistrationRequest };

type TradeApprovalOutcome =
  | null
  | { kind: "failed"; message: JobFailedMessage }
  | { kind: "confirmed" };

/**
 * Receipt Worker.
 * status = SUBMITTED 인 트랜잭션을 폴링하여 영수증을 확인하고
 * CONFIRMED(성공 → Market gRPC 전달) 또는 FAILED(타임아웃) 로 전이시킨다.
 */
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

  private sleep(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, env.receiptWorkerIntervalMs));
  }

  private async processContentRegistration(): Promise<void> {
    const outcome: ContentRegistrationOutcome = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "content_registration_transactions"
        WHERE "status" = 'SUBMITTED'
        ORDER BY "created_at" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;

      const row = await tx.contentRegistrationTransaction.findUniqueOrThrow({
        where: { id: rows[0].id },
      });

      // 타임아웃: createdAt 기준 5분 경과 시 FAILED.
      if (Date.now() - row.createdAt.getTime() >= RECEIPT_TIMEOUT_MS) {
        const reason = "Transaction receipt timeout";
        await tx.contentRegistrationTransaction.update({
          where: { id: row.id },
          data: { status: "FAILED", failureReason: reason },
        });
        return {
          kind: "failed",
          message: {
            jobId: row.jobId,
            requestedAt: row.createdAt.toISOString(),
            failedStage: "BLOCKCHAIN",
            reason,
            proofType: "CONTENT_REGISTRATION",
            registrationId: row.registrationId,
          } satisfies JobFailedMessage,
        };
      }

      // TODO: 실제 영수증 조회 (blockchain RPC). 현재는 항상 confirmed.
      const receipt = await checkContentRegistrationReceipt(row.txHash!);
      if (!receipt.confirmed) {
        return null; // 아직 확정되지 않음 → 다음 폴링에서 재시도.
      }

      await tx.contentRegistrationTransaction.update({
        where: { id: row.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      return {
        kind: "confirmed",
        request: {
          jobId: row.jobId,
          registrationId: row.registrationId,
          encryptedData: row.encryptedData,
          dataIv: row.dataIv,
          encryptedDataKey: row.encryptedDataKey,
          keyIv: row.keyIv,
          keyAuthTag: row.keyAuthTag,
          encryptionVersion: row.encryptionVersion,
          keyHash: row.keyHash,
          encryptedDataHash: row.encryptedDataHash,
          contentHash: row.contentHash,
          txHash: row.txHash!,
        },
      };
    });

    if (outcome?.kind === "failed") {
      await this.reportFailure(outcome.message);
    } else if (outcome?.kind === "confirmed") {
      await this.reportContentRegistrationSuccess(outcome.request);
    }
  }

  private async processTradeApproval(): Promise<void> {
    const outcome: TradeApprovalOutcome = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "trade_approval_transactions"
        WHERE "status" = 'SUBMITTED'
        ORDER BY "created_at" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;
      if (rows.length === 0) return null;

      const row = await tx.tradeApprovalTransaction.findUniqueOrThrow({
        where: { id: rows[0].id },
      });

      if (Date.now() - row.createdAt.getTime() >= RECEIPT_TIMEOUT_MS) {
        const reason = "Transaction receipt timeout";
        await tx.tradeApprovalTransaction.update({
          where: { id: row.id },
          data: { status: "FAILED", failureReason: reason },
        });
        return {
          kind: "failed",
          message: {
            jobId: row.jobId,
            requestedAt: row.createdAt.toISOString(),
            failedStage: "BLOCKCHAIN",
            reason,
            proofType: "TRADE_APPROVAL",
            purchaseId: row.purchaseId,
          } satisfies JobFailedMessage,
        };
      }

      const receipt = await checkTradeApprovalReceipt(row.txHash!);
      if (!receipt.confirmed) {
        return null;
      }

      await tx.tradeApprovalTransaction.update({
        where: { id: row.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      return { kind: "confirmed" };
    });

    if (outcome?.kind === "failed") {
      await this.reportFailure(outcome.message);
    } else if (outcome?.kind === "confirmed") {
      // TODO: 거래 승인용 Market gRPC RPC(CompleteTradeApproval) 가 아직 정의되지 않음.
      //       market.proto 에 추가되면 여기서 호출한다.
      console.log("[blockchain-worker] trade approval CONFIRMED (market completion TODO)");
    }
  }

  private async reportFailure(message: JobFailedMessage): Promise<void> {
    try {
      await sendBlockchainFailed(message);
    } catch (error) {
      console.error("[blockchain-worker] failed to send Kafka failure message:", error);
    }
  }

  private async reportContentRegistrationSuccess(
    request: Market.CompleteContentRegistrationRequest,
  ): Promise<void> {
    try {
      await completeContentRegistration(request);
      console.log(
        `[blockchain-worker] market completion succeeded jobId=${request.jobId} registrationId=${request.registrationId}`,
      );
    } catch (error) {
      console.error("[blockchain-worker] failed to complete content registration:", error);
    }
  }
}
