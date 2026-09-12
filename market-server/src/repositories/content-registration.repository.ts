import { prisma } from "../lib/prisma.js";
import { PrismaClient, Prisma } from "@prisma/client";

export const contentRegistrationRepository = {

  async create(
    data: {
      title: string;
      description: string;
      authorId: number;
      price: number;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.contentRegistration.create({
      data,
    });
  },

  async findManyByAuthor(authorId: number, skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.contentRegistration.findMany({
        where: { authorId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.contentRegistration.count({ where: { authorId } }),
    ]);
    return { items, total };
  },

  async createWithSource(data: {
    title: string;
    description: string;
    authorId: number;
    price: number;
    originalText: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const registration = await this.create(
        {
          title: data.title,
          description: data.description,
          authorId: data.authorId,
          price: data.price,
        },
        tx
      );

      await contentRegistrationSourceRepository.create(
        {
          registrationId: registration.id,
          originalText: data.originalText,
        },
        tx
      );

      return registration;
    });
  },

  async completeRegistration({
    registrationId,
    encryptedData,
    iv,
    authTag,
    encryptedDataKey,
    contentHash,
    encryptionVersion,
    txHash,
  }: {
    registrationId: number;
    encryptedData: string;
    iv: string;
    authTag: string;
    encryptedDataKey: string;
    contentHash: string;
    encryptionVersion: number;
    txHash: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. 등록 요청 조회
      const registration = await tx.contentRegistration.findUnique({
        where: {
          id: registrationId,
        },
      });

      if (!registration) {
        throw new Error(
          `ContentRegistration not found: ${registrationId}`
        );
      }

      // 2. ContentList 생성
      const content = await tx.contentList.create({
        data: {
          title: registration.title,
          authorId: registration.authorId,
          description: registration.description,
          price: registration.price,

          encryptedData,
          iv,
          authTag,
          encryptedDataKey,

          encryptionVersion,
          contentHash,

          status: "ACTIVE",
          txHash,
        },
      });

      // 3. ContentRegistration 업데이트
      const updatedRegistration = await tx.contentRegistration.update({
        where: {
          id: registrationId,
        },
        data: {
          status: "APPROVED",
          contentId: content.id,
        },
      });

      //4. contentRegistrationSource 삭제
      await tx.contentRegistrationSource.delete({
        where: {
          registrationId,
        },
      });

      return {
        registration: updatedRegistration,
        content,
      };
    });
  },

  async failedRegistration({
    registrationId,
    reason,
  }: {
    registrationId: number,
    reason: string
  }
  ) {
    return prisma.$transaction(async (tx) => {
      const registration = await tx.contentRegistration.findUnique({
        where: {
          id: registrationId,
        },
      });

      if (!registration) {
        throw new Error(
          `ContentRegistration not found: ${registrationId}`
        );
      }

      const updatedRegistration = await tx.contentRegistration.update({
          where: {
            id: registrationId,
          },
          data: {
            status: "REJECTED",
            rejectionReason: reason,
          },
        });

      await tx.contentRegistrationSource.deleteMany({
        where: {
          registrationId,
        },
      });

      return updatedRegistration;
    });
  },
};

export const contentRegistrationSourceRepository = {
  async create(
    data: {
      registrationId: number;
      originalText: string;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.contentRegistrationSource.create({
      data,
    });
  },
}