/*
  Warnings:

  - The values [ACCOUNT_REGISTRATION_RESULT_CONFIRM,ACCOUNT_REGISTRATION_RESULT_FAIL] on the enum `OutboxEventType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `failed_stage` on the `account_registration` table. All the data in the column will be lost.
  - You are about to drop the column `job_failure_reason` on the `account_registration` table. All the data in the column will be lost.
  - You are about to drop the column `failed_stage` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `job_failure_reason` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `retry_count` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `failed_stage` on the `trade_approval_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `job_failure_reason` on the `trade_approval_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `retry_count` on the `trade_approval_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `job_failure_reason` on the `transaction_outbox` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OutboxEventType_new" AS ENUM ('TRANSACTION_REQUESTED', 'RECEIPT_CHECK_REQUESTED', 'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED', 'PROOF_FAILED', 'ACCOUNT_REGISTRATION_RESULT');
ALTER TABLE "transaction_outbox" ALTER COLUMN "event_type" TYPE "OutboxEventType_new" USING ("event_type"::text::"OutboxEventType_new");
ALTER TYPE "OutboxEventType" RENAME TO "OutboxEventType_old";
ALTER TYPE "OutboxEventType_new" RENAME TO "OutboxEventType";
DROP TYPE "public"."OutboxEventType_old";
COMMIT;

-- DropIndex
DROP INDEX "account_registration_addr_idx";

-- DropIndex
DROP INDEX "content_registration_transactions_registration_id_idx";

-- DropIndex
DROP INDEX "trade_approval_transactions_purchase_id_idx";

-- DropIndex
DROP INDEX "transaction_outbox_job_type_status_idx";

-- AlterTable
ALTER TABLE "account_registration" DROP COLUMN "failed_stage",
DROP COLUMN "job_failure_reason";

-- AlterTable
ALTER TABLE "content_registration_transactions" DROP COLUMN "failed_stage",
DROP COLUMN "job_failure_reason",
DROP COLUMN "retry_count";

-- AlterTable
ALTER TABLE "trade_approval_transactions" DROP COLUMN "failed_stage",
DROP COLUMN "job_failure_reason",
DROP COLUMN "retry_count";

-- AlterTable
ALTER TABLE "transaction_outbox" DROP COLUMN "job_failure_reason";

-- CreateTable
CREATE TABLE "job_failures" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "job_type" "OutboxJobType" NOT NULL,
    "reference_id" INTEGER,
    "failure_reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_failures_job_id_idx" ON "job_failures"("job_id");

-- CreateIndex
CREATE INDEX "account_registration_job_id_idx" ON "account_registration"("job_id");

-- CreateIndex
CREATE INDEX "content_registration_transactions_job_id_idx" ON "content_registration_transactions"("job_id");

-- CreateIndex
CREATE INDEX "trade_approval_transactions_job_id_idx" ON "trade_approval_transactions"("job_id");
