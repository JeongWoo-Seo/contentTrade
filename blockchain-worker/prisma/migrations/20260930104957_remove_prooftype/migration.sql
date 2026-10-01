/*
  Warnings:

  - You are about to drop the column `proof_type` on the `transaction_outbox` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transaction_outbox" DROP COLUMN "proof_type";
