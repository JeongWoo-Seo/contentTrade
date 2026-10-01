-- AlterTable
ALTER TABLE "transaction_outbox" ADD COLUMN     "failed_stage" "FailedStage",
ADD COLUMN     "requested_at" TIMESTAMP(3);
