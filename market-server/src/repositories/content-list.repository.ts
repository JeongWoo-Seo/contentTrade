import { prisma } from "../lib/prisma.js";

export const contentListRepository = {
  // 목록 조회: 본문/암호화 데이터는 select에서 제외하고, 작가 username만 JOIN 한다.
  async findManyWithAuthor(skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.contentList.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          status: true,
          contentHash: true,
          author: { select: { username: true } },
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.contentList.count(),
    ]);
    return { items, total };
  },
};
