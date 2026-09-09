/*
  Warnings:

  - The values [PENDING,SOLD_OUT,BLOCKED] on the enum `ContentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContentStatus_new" AS ENUM ('ACTIVE', 'DISCONTINUED', 'BANNED');
ALTER TABLE "public"."content_list" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "content_list" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TYPE "ContentStatus" RENAME TO "ContentStatus_old";
ALTER TYPE "ContentStatus_new" RENAME TO "ContentStatus";
DROP TYPE "public"."ContentStatus_old";
ALTER TABLE "content_list" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropIndex
DROP INDEX "content_registrations_status_idx";

-- AlterTable
ALTER TABLE "content_list" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "content_registrations" ADD COLUMN     "content_id" INTEGER;
