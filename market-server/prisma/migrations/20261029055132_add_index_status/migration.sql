-- DropIndex
DROP INDEX "outbox_job_type_reference_id_idx";

-- DropIndex
DROP INDEX "outbox_published_at_created_at_idx";

-- CreateIndex
CREATE INDEX "outbox_status_created_at_idx" ON "outbox"("status", "created_at");
