import { prisma } from "../lib/prisma.js";
import { outboxRepository } from "./outbox.repository.js";

export const buyHistoryRepository = {
  // 특정 사용자의 특정 소설 구매 이력 조회 (진행중/완료 여부 확인용).
  async findByBuyerAndContent(buyerId: number, contentId: number) {
    return prisma.buyHistory.findFirst({
      where: { buyerId, contentId },
      select: { status: true },
    });
  },

  async findById(id: number) {
    return prisma.buyHistory.findUnique({
      where: { id },
      select: { id: true, txHash: true },
    });
  },

  // 거래 승인 데이터 조회용: content(암호화 키/hash/작가) + buyer(pkEnc).
  async findByIdWithContentAndBuyer(id: number) {
    return prisma.buyHistory.findUnique({
      where: { id },
      select: {
        content: {
          select: {
            encryptedDataKey: true,
            ctR: true,
            price: true,
            hK: true,
            author: { select: { pkOwn: true } },
          },
        },
        buyer: { select: { pkEnc: true } },
      },
    });
  },

  /**
   * 구매 요청(BuyHistory) + 구매 요청 확인용 Outbox를 하나의 transaction으로 생성한다.
   * referenceId는 BuyHistory.id.
   */
  async createWithOutbox(data: {
    jobId: string;
    buyerId: number;
    contentId: number;
    txHash: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const buyHistory = await tx.buyHistory.create({
        data: {
          buyerId: data.buyerId,
          contentId: data.contentId,
          status: "REVIEWING",
          txHash: data.txHash,
        },
      });

      await outboxRepository.create(tx, {
        jobId: data.jobId,
        jobType: "PURCHASE_VERIFICATION",
        referenceId: buyHistory.id,
      });

      return buyHistory;
    });
  },

  /**
   * 구매 이력 상태를 REVIEWING → APPROVING/REJECTED로 전이한다.
   * APPROVING(정상)인 경우 거래 승인 절차용 Outbox(TRADE_APPROVAL)를 함께 생성한다.
   * REVIEWING에서만 전이하므로 중복 결과 메시지에도 멱등하다.
   */
  async markPurchaseStatusWithOutbox({
    id,
    status,
    rejectionReason,
    tradeApprovalJobId,
  }: {
    id: number;
    status: "APPROVING" | "REJECTED";
    rejectionReason?: string;
    tradeApprovalJobId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.buyHistory.updateMany({
        where: { id, status: "REVIEWING" },
        data: {
          status,
          rejectionReason: status === "REJECTED" ? (rejectionReason ?? null) : undefined,
        },
      });

      if (updated.count === 0) {
        return false;
      }

      // 정상(APPROVING)인 경우 거래 승인 절차를 위한 Outbox 생성
      if (status === "APPROVING") {
        await outboxRepository.create(tx, {
          jobId: tradeApprovalJobId,
          jobType: "TRADE_APPROVAL",
          referenceId: id,
        });
      }

      return true;
    });
  },
};
