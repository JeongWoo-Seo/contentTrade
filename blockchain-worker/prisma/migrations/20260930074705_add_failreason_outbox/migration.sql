/*
  Warnings:

  - You are about to alter the column `key_hash` on the `content_registration_transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(64)`.
  - You are about to alter the column `encrypted_data_hash` on the `content_registration_transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(64)`.
  - You are about to alter the column `content_hash` on the `content_registration_transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(64)`.
  - Changed the type of `encrypted_data` on the `content_registration_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `data_iv` on the `content_registration_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `encrypted_data_key` on the `content_registration_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `key_iv` on the `content_registration_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `key_auth_tag` on the `content_registration_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `proof_type` to the `transaction_outbox` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FailedStage" AS ENUM ('PROOF', 'BLOCKCHAIN');

-- AlterEnum
ALTER TYPE "OutboxEventType" ADD VALUE 'PROOF_FAILED';

-- AlterTable
ALTER TABLE "content_registration_transactions" DROP COLUMN "encrypted_data",
ADD COLUMN     "encrypted_data" BYTEA NOT NULL,
DROP COLUMN "data_iv",
ADD COLUMN     "data_iv" BYTEA NOT NULL,
DROP COLUMN "encrypted_data_key",
ADD COLUMN     "encrypted_data_key" BYTEA NOT NULL,
DROP COLUMN "key_iv",
ADD COLUMN     "key_iv" BYTEA NOT NULL,
DROP COLUMN "key_auth_tag",
ADD COLUMN     "key_auth_tag" BYTEA NOT NULL,
ALTER COLUMN "key_hash" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "encrypted_data_hash" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "content_hash" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "transaction_outbox" ADD COLUMN     "fail_reason" TEXT,
ADD COLUMN     "proof_type" "OutboxJobType" NOT NULL,
ADD COLUMN     "purchase_id" INTEGER,
ADD COLUMN     "registration_id" INTEGER;
