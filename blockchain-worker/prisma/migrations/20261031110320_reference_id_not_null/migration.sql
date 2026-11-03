/*
  Warnings:

  - Made the column `reference_id` on table `job_failures` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "job_failures" ALTER COLUMN "reference_id" SET NOT NULL;
