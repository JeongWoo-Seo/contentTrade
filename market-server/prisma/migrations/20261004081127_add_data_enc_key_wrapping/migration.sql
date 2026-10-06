/*
  Warnings:

  - Added the required column `ct_r` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_data_key` to the `content_list` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "content_list" ADD COLUMN     "ct_r" BYTEA NOT NULL,
ADD COLUMN     "encrypted_data_key" BYTEA NOT NULL,
ADD COLUMN     "encryption_version" INTEGER NOT NULL DEFAULT 1;
