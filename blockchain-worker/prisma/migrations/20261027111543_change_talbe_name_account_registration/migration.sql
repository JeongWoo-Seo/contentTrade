/*
  Warnings:

  - You are about to drop the `user_registration_checks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "transaction_outbox" DROP CONSTRAINT "transaction_outbox_account_registration_id_fkey";

-- DropTable
DROP TABLE "user_registration_checks";

-- CreateTable
CREATE TABLE "account_registration" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "addr" VARCHAR(255) NOT NULL,
    "tx_hash" VARCHAR(255) NOT NULL,
    "status" "AccountRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_registration_job_id_key" ON "account_registration"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_registration_tx_hash_key" ON "account_registration"("tx_hash");

-- CreateIndex
CREATE INDEX "account_registration_addr_idx" ON "account_registration"("addr");

-- AddForeignKey
ALTER TABLE "transaction_outbox" ADD CONSTRAINT "transaction_outbox_account_registration_id_fkey" FOREIGN KEY ("account_registration_id") REFERENCES "account_registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
