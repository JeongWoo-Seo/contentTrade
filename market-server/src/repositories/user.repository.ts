import { prisma } from "../lib/prisma.js";

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
};
