-- CreateEnum
CREATE TYPE "TransactionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxJobType" AS ENUM ('CONTENT_REGISTRATION', 'TRADE_APPROVAL');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('TRANSACTION_REQUESTED', 'RECEIPT_CHECK_REQUESTED', 'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED');

-- CreateTable
CREATE TABLE "content_registration_transactions" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "proof" TEXT NOT NULL,
    "public_signals" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "data_iv" VARCHAR(255) NOT NULL,
    "encrypted_data_key" TEXT NOT NULL,
    "key_iv" VARCHAR(255) NOT NULL,
    "key_auth_tag" VARCHAR(255) NOT NULL,
    "encryption_version" INTEGER NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "encrypted_data_hash" VARCHAR(255) NOT NULL,
    "content_hash" VARCHAR(255) NOT NULL,
    "tx_hash" VARCHAR(255),
    "status" "TransactionJobStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_registration_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_approval_transactions" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "proof" TEXT NOT NULL,
    "public_signals" TEXT NOT NULL,
    "status" "TransactionJobStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" VARCHAR(255),
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trade_approval_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_outbox" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "job_type" "OutboxJobType" NOT NULL,
    "event_type" "OutboxEventType" NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "published_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_registration_transactions_job_id_key" ON "content_registration_transactions"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_registration_transactions_tx_hash_key" ON "content_registration_transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "content_registration_transactions_status_idx" ON "content_registration_transactions"("status");

-- CreateIndex
CREATE INDEX "content_registration_transactions_registration_id_idx" ON "content_registration_transactions"("registration_id");

-- CreateIndex
CREATE INDEX "content_registration_transactions_created_at_idx" ON "content_registration_transactions"("created_at");

-- CreateIndex
CREATE INDEX "content_registration_transactions_status_created_at_idx" ON "content_registration_transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "trade_approval_transactions_job_id_key" ON "trade_approval_transactions"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "trade_approval_transactions_tx_hash_key" ON "trade_approval_transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "trade_approval_transactions_status_idx" ON "trade_approval_transactions"("status");

-- CreateIndex
CREATE INDEX "trade_approval_transactions_purchase_id_idx" ON "trade_approval_transactions"("purchase_id");

-- CreateIndex
CREATE INDEX "trade_approval_transactions_created_at_idx" ON "trade_approval_transactions"("created_at");

-- CreateIndex
CREATE INDEX "trade_approval_transactions_status_created_at_idx" ON "trade_approval_transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "transaction_outbox_status_created_at_idx" ON "transaction_outbox"("status", "created_at");

-- CreateIndex
CREATE INDEX "transaction_outbox_job_id_idx" ON "transaction_outbox"("job_id");

-- CreateIndex
CREATE INDEX "transaction_outbox_job_type_status_idx" ON "transaction_outbox"("job_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_outbox_job_id_event_type_key" ON "transaction_outbox"("job_id", "event_type");
