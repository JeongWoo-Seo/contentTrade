-- CreateTable
CREATE TABLE "purchase_verification" (
    "id" SERIAL NOT NULL,
    "job_id" VARCHAR(100) NOT NULL,
    "tx_hash" VARCHAR(255) NOT NULL,
    "reference_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_verification_job_id_key" ON "purchase_verification"("job_id");

-- CreateIndex
CREATE INDEX "purchase_verification_job_id_idx" ON "purchase_verification"("job_id");
