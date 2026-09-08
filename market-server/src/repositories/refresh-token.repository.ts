import { prisma } from "../lib/prisma.js";

export interface RefreshTokenCreate {
  userId: number;
  tokenHash: string;
  jti: string;
  familyId: string;
  expiresAt: Date;
}

export const refreshTokenRepository = {
  findByJti(jti: string) {
    return prisma.refreshToken.findUnique({ where: { jti } });
  },

  create(data: RefreshTokenCreate) {
    return prisma.refreshToken.create({ data });
  },

  // Revoke every still-active token in a rotation family (reuse detection).
  revokeFamily(familyId: string) {
    return prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // Revoke all active sessions for a user (logout fallback / logout-all).
  revokeAllForUser(userId: number) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async rotate(oldId: number, replacedByJti: string, newToken: RefreshTokenCreate): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: new Date(), replacedBy: replacedByJti },
      });

      if (revoked.count === 0) {
        return false;
      }

      await tx.refreshToken.create({ data: newToken });
      return true;
    });
  },
};
