/*
  Warnings:

  - The values [ACCOUNT_REGISTRATION_RESULT_CONFIRM,ACCOUNT_REGISTRATION_RESULT_FAIL] on the enum `OutboxEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OutboxEventType_new" AS ENUM ('TRANSACTION_REQUESTED', 'RECEIPT_CHECK_REQUESTED', 'TRANSACTION_COMPLETED', 'TRANSACTION_FAILED', 'PROOF_FAILED', 'ACCOUNT_REGISTRATION_RESULT');
ALTER TABLE "transaction_outbox" ALTER COLUMN "event_type" TYPE "OutboxEventType_new" USING ("event_type"::text::"OutboxEventType_new");
ALTER TYPE "OutboxEventType" RENAME TO "OutboxEventType_old";
ALTER TYPE "OutboxEventType_new" RENAME TO "OutboxEventType";
DROP TYPE "public"."OutboxEventType_old";
COMMIT;
