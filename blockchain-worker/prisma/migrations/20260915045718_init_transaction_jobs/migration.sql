-- CreateEnum
CREATE TYPE "TransactionJobStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('CONTENT_REGISTRATION', 'TRADE_APPROVAL');

-- CreateTable
CREATE TABLE "transaction_jobs" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "proof_type" "ProofType" NOT NULL,
    "proof" TEXT NOT NULL,
    "status" "TransactionJobStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" VARCHAR(255),
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_jobs_job_id_key" ON "transaction_jobs"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_jobs_tx_hash_key" ON "transaction_jobs"("tx_hash");

-- CreateIndex
CREATE INDEX "transaction_jobs_status_idx" ON "transaction_jobs"("status");

-- CreateIndex
CREATE INDEX "transaction_jobs_created_at_idx" ON "transaction_jobs"("created_at");

-- CreateIndex
CREATE INDEX "transaction_jobs_status_created_at_idx" ON "transaction_jobs"("status", "created_at");
