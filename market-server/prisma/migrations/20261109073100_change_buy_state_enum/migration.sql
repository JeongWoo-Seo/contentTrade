/*
  Warnings:

  - The values [REQUESTED,PENDING] on the enum `BuyStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `price` on the `buy_history` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BuyStatus_new" AS ENUM ('REVIEWING', 'APPROVING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."buy_history" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "buy_history" ALTER COLUMN "status" TYPE "BuyStatus_new" USING ("status"::text::"BuyStatus_new");
ALTER TYPE "BuyStatus" RENAME TO "BuyStatus_old";
ALTER TYPE "BuyStatus_new" RENAME TO "BuyStatus";
DROP TYPE "public"."BuyStatus_old";
ALTER TABLE "buy_history" ALTER COLUMN "status" SET DEFAULT 'REVIEWING';
COMMIT;

-- AlterTable
ALTER TABLE "buy_history" DROP COLUMN "price",
ALTER COLUMN "status" SET DEFAULT 'REVIEWING';
