-- AlterTable
ALTER TABLE "user" ADD COLUMN "wallet_address" VARCHAR(42) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_wallet_address_key" ON "user"("wallet_address");
