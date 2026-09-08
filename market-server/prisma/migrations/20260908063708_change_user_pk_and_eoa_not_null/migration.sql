/*
  Warnings:

  - Made the column `pk_own` on table `user` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pk_enc` on table `user` required. This step will fail if there are existing NULL values in that column.
  - Made the column `eoa` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user" ALTER COLUMN "pk_own" SET NOT NULL,
ALTER COLUMN "pk_enc" SET NOT NULL,
ALTER COLUMN "eoa" SET NOT NULL;
