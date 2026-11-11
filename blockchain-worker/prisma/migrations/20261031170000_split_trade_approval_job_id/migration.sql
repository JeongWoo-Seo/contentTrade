-- DropIndex
DROP INDEX "trade_approval_transactions_job_id_key";
DROP INDEX "trade_approval_transactions_job_id_idx";

-- RenameColumn
ALTER TABLE "trade_approval_transactions" RENAME COLUMN "job_id" TO "verification_job_id";

-- AlterTable
ALTER TABLE "trade_approval_transactions" ADD COLUMN "approval_job_id" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "trade_approval_transactions_verification_job_id_key" ON "trade_approval_transactions"("verification_job_id");
CREATE INDEX "trade_approval_transactions_verification_job_id_idx" ON "trade_approval_transactions"("verification_job_id");
CREATE UNIQUE INDEX "trade_approval_transactions_approval_job_id_key" ON "trade_approval_transactions"("approval_job_id");
