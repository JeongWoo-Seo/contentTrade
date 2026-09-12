/*
  Warnings:

  - Added the required column `tx_hash` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Made the column `content_hash` on table `content_list` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "content_list" ADD COLUMN     "tx_hash" TEXT NOT NULL,
ALTER COLUMN "content_hash" SET NOT NULL;

-- CreateTable
CREATE TABLE "content_registration_sources" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_registration_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_registration_sources_registration_id_key" ON "content_registration_sources"("registration_id");

-- AddForeignKey
ALTER TABLE "content_registration_sources" ADD CONSTRAINT "content_registration_sources_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "content_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
