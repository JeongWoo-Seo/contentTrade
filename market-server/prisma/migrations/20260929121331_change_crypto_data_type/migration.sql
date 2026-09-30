/*
  Warnings:

  - You are about to drop the column `keyIv` on the `content_list` table. All the data in the column will be lost.
  - Added the required column `key_iv` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `encrypted_data` on the `content_list` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `encrypted_data_key` on the `content_list` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `data_iv` on the `content_list` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `key_auth_tag` on the `content_list` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "OutboxJobType" AS ENUM ('CONTENT_REGISTRATION', 'TRADE_APPROVAL');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "content_list" DROP COLUMN "keyIv",
ADD COLUMN     "key_iv" BYTEA NOT NULL,
DROP COLUMN "encrypted_data",
ADD COLUMN     "encrypted_data" BYTEA NOT NULL,
DROP COLUMN "encrypted_data_key",
ADD COLUMN     "encrypted_data_key" BYTEA NOT NULL,
DROP COLUMN "data_iv",
ADD COLUMN     "data_iv" BYTEA NOT NULL,
DROP COLUMN "key_auth_tag",
ADD COLUMN     "key_auth_tag" BYTEA NOT NULL;

-- CreateTable
CREATE TABLE "outbox" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "job_type" "OutboxJobType" NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "published_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_published_at_created_at_idx" ON "outbox"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "outbox_job_id_idx" ON "outbox"("job_id");

-- CreateIndex
CREATE INDEX "outbox_job_type_reference_id_idx" ON "outbox"("job_type", "reference_id");
