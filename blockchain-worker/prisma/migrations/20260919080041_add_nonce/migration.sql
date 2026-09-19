/*
  Warnings:

  - You are about to drop the column `processingStarted_at` on the `content_registration_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "content_registration_transactions" DROP COLUMN "processingStarted_at",
ADD COLUMN     "nonce" INTEGER,
ADD COLUMN     "processing_started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "trade_approval_transactions" ADD COLUMN     "nonce" INTEGER,
ADD COLUMN     "processing_started_at" TIMESTAMP(3);
