import { prisma } from "../lib/prisma.js";

export const contentRegistrationRepository = {
  create(data: {
    title: string;
    description: string;
    authorId: number;
    price: number;
  }) {
    return prisma.contentRegistration.create({ data });
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
};
