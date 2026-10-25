-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tx_hash" VARCHAR(66);
