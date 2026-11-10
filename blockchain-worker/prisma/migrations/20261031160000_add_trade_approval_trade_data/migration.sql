-- AlterTable
ALTER TABLE "trade_approval_transactions"
ADD COLUMN "trade_data" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "proof" DROP NOT NULL,
ALTER COLUMN "public_signals" DROP NOT NULL;
