// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // 개발 시 SQL 쿼리 로그 출력
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}