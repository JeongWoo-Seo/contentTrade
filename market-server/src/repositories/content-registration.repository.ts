import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";

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
    dataIv,
    keyIv,
    keyAuthTag,
    encryptedDataKey,
    encryptionVersion,
    contentHash,
    keyHash,
    encryptedDataHash,
    txHash,
  }: {
    registrationId: number;
    encryptedData: string;
    dataIv: string;
    encryptedDataKey: string;
    keyIv: string;
    keyAuthTag: string;
    encryptionVersion: number;
    keyHash: string;
    encryptedDataHash: string;
    contentHash: string;
    txHash: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. registration row lock
      await tx.$queryRaw(
        Prisma.sql`
      SELECT id
      FROM content_registrations
      WHERE id = ${registrationId}
      FOR UPDATE`
      );

      // 2. 등록 요청 조회
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

      // 이미 완료된 등록이면 기존 결과 반환
      if (registration.status === "APPROVED" && registration.contentId !== null) {
        const content = await tx.contentList.findUnique({
          where: {
            id: registration.contentId,
          },
        });

        if (!content) {
          throw new Error(`ContentList not found: ${registration.contentId}`);
        }

        return {
          registration,
          content,
        };
      }

      //이미 컨텐츠 등록이 거절된 경우
      if (registration.status === "REJECTED") {
        throw new Error(`ContentRegistration already rejected: ${registrationId}`);
      }

      // 3. ContentList 생성
      const content = await tx.contentList.create({
        data: {
          title: registration.title,
          authorId: registration.authorId,
          description: registration.description,
          price: registration.price,
          encryptedData,
          dataIv,
          keyAuthTag,
          encryptedDataKey,
          keyIv,
          encryptionVersion,
          contentHash,
          keyHash,
          encryptedDataHash,
          status: "ACTIVE",
          txHash,
        },
      });

      // 4. ContentRegistration 업데이트
      const updatedRegistration = await tx.contentRegistration.update({
        where: {
          id: registrationId,
        },
        data: {
          status: "APPROVED",
          contentId: content.id,
        },
      });

      //5. contentRegistrationSource 삭제
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
      //registration row lock
      await tx.$queryRaw(
        Prisma.sql`
        SELECT id
        FROM content_registrations
        WHERE id = ${registrationId}
        FOR UPDATE
      `
      );

      //컨텐츠 등록 조회
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

      // 이미 완료된 작업이면 아무 것도 하지 않음
      if (registration.status === "APPROVED" || registration.status === "REJECTED") {
        return registration;
      }

      //등록 업데이트
      const updatedRegistration = await tx.contentRegistration.update({
        where: {
          id: registrationId,
        },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
        },
      });

      // source 삭제
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

  async findByRegistrationId(registrationId: number) {
    return prisma.contentRegistrationSource.findUnique({
      where: {
        registrationId,
      },
      select: {
        originalText: true,

        registration: {
          select: {
            id: true,

            author: {
              select: {
                pkOwn: true,
              },
            },
          },
        },
      },
    });
  },
}