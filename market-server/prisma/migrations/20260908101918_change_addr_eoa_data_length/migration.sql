/*
  Warnings:

  - You are about to alter the column `eoa` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(64)` to `VarChar(42)`.

*/
-- AlterTable
ALTER TABLE "user" ALTER COLUMN "addr" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "eoa" SET DATA TYPE VARCHAR(42);
