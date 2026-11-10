-- CreateEnum
CREATE TYPE "PurchaseVerificationStatus" AS ENUM ('PENDING', 'CHECKING', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "purchase_verification" ADD COLUMN     "status" "PurchaseVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "confirmed_at" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "OutboxEventType" ADD VALUE 'PURCHASE_VERIFICATION_RESULT';
