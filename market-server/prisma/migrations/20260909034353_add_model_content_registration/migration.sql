/*
  Warnings:

  - The values [COMPLETED,FAILED] on the enum `BuyStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "BuyStatus_new" AS ENUM ('REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."buy_history" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "buy_history" ALTER COLUMN "status" TYPE "BuyStatus_new" USING ("status"::text::"BuyStatus_new");
ALTER TYPE "BuyStatus" RENAME TO "BuyStatus_old";
ALTER TYPE "BuyStatus_new" RENAME TO "BuyStatus";
DROP TYPE "public"."BuyStatus_old";
ALTER TABLE "buy_history" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- AlterTable
ALTER TABLE "buy_history" ADD COLUMN     "rejection_reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

-- CreateTable
CREATE TABLE "content_registrations" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "author_id" INTEGER NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_registrations_author_id_idx" ON "content_registrations"("author_id");

-- CreateIndex
CREATE INDEX "content_registrations_status_idx" ON "content_registrations"("status");

-- CreateIndex
CREATE INDEX "content_registrations_created_at_idx" ON "content_registrations"("created_at");

-- AddForeignKey
ALTER TABLE "content_registrations" ADD CONSTRAINT "content_registrations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
