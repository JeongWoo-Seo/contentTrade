/*
  Warnings:

  - Made the column `tx_hash` on table `user` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "user" ALTER COLUMN "tx_hash" SET NOT NULL;
