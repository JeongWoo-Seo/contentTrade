/*
  Warnings:

  - You are about to drop the column `wallet_address` on the `user` table. All the data in the column will be lost.
  - You are about to alter the column `addr` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(64)` to `VarChar(42)`.

*/
-- DropIndex
DROP INDEX "user_wallet_address_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "wallet_address",
ALTER COLUMN "addr" SET DATA TYPE VARCHAR(42),
ALTER COLUMN "eoa" SET DATA TYPE VARCHAR(64);
