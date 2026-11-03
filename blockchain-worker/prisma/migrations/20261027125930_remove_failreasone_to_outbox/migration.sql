/*
  Warnings:

  - You are about to drop the column `account_registration_id` on the `transaction_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `fail_reason` on the `transaction_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `failed_stage` on the `transaction_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `purchase_id` on the `transaction_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `registration_id` on the `transaction_outbox` table. All the data in the column will be lost.
  - You are about to drop the column `requested_at` on the `transaction_outbox` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "OutboxEventType" ADD VALUE 'ACCOUNT_REGISTRATION_RESULT';

-- DropForeignKey
ALTER TABLE "transaction_outbox" DROP CONSTRAINT "transaction_outbox_account_registration_id_fkey";

-- AlterTable
ALTER TABLE "account_registration" ADD COLUMN     "failed_stage" "FailedStage";

-- AlterTable
ALTER TABLE "content_registration_transactions" ADD COLUMN     "failed_stage" "FailedStage";

-- AlterTable
ALTER TABLE "trade_approval_transactions" ADD COLUMN     "failed_stage" "FailedStage";

-- AlterTable
ALTER TABLE "transaction_outbox" DROP COLUMN "account_registration_id",
DROP COLUMN "fail_reason",
DROP COLUMN "failed_stage",
DROP COLUMN "purchase_id",
DROP COLUMN "registration_id",
DROP COLUMN "requested_at";
