/*
  Warnings:

  - You are about to drop the column `job_failed_stage` on the `transaction_outbox` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transaction_outbox" DROP COLUMN "job_failed_stage";
