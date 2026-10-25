import { prisma } from "../lib/prisma.js";
import { outboxRepository } from "./outbox.repository.js";

export const userRepository = {
  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  findByWalletAddress(addr: string) {
    return prisma.user.findUnique({ where: { addr } });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: {
    username: string;
    passwordHash: string;
    addr: string;
    pkOwn: string;
    pkEnc: string;
    eoa: string;
  }) {
    return prisma.user.create({ data });
  },

  /**
   * 회원 저장(PENDING) + 계좌 확인용 Outbox 이벤트를 하나의 transaction으로 생성한다.
   * 둘 중 하나라도 실패하면 전체가 롤백된다.
   */
  async createWithOutbox(data: {
    jobId: string;
    username: string;
    passwordHash: string;
    addr: string;
    pkOwn: string;
    pkEnc: string;
    eoa: string;
    txHash: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          passwordHash: data.passwordHash,
          addr: data.addr,
          pkOwn: data.pkOwn,
          pkEnc: data.pkEnc,
          eoa: data.eoa,
          txHash: data.txHash,
          status: "PENDING",
        },
      });

      await outboxRepository.create(tx, {
        jobId: data.jobId,
        jobType: "ACCOUNT_REGISTRATION",
        referenceId: user.id,
      });

      return user;
    });
  },

  /**
   * 가입 상태를 ACTIVE/REJECTED로 전이한다.
   * PENDING → 최종 상태로만 전이하며, 이미 전이된 경우(중복 메시지)에는 no-op.
   * (where에 status: PENDING을 걸어 멱등성 보장)
   */
  async markAccountStatus(userId: number, status: "ACTIVE" | "REJECTED") {
    return prisma.user.updateMany({
      where: { id: userId, status: "PENDING" },
      data: { status },
    });
  },
};
