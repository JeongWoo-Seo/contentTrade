/*
  Warnings:

  - You are about to drop the column `failure_reason` on the `account_registration` table. All the data in the column will be lost.
  - You are about to drop the column `failure_reason` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `failure_reason` on the `trade_approval_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "account_registration" DROP COLUMN "failure_reason",
ADD COLUMN     "job_failure_reason" TEXT;

-- AlterTable
ALTER TABLE "content_registration_transactions" DROP COLUMN "failure_reason",
ADD COLUMN     "job_failure_reason" TEXT;

-- AlterTable
ALTER TABLE "trade_approval_transactions" DROP COLUMN "failure_reason",
ADD COLUMN     "job_failure_reason" TEXT;

-- AlterTable
ALTER TABLE "transaction_outbox" ADD COLUMN     "job_failure_reason" TEXT;
