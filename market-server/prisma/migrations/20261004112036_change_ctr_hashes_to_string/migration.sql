/*
  Warnings:

  - You are about to alter the column `h_ct` on the `content_list` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(64)`.
  - You are about to alter the column `h_data` on the `content_list` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(64)`.
  - You are about to alter the column `h_k` on the `content_list` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(64)`.
  - You are about to alter the column `ct_r` on the `content_list` table. The data in that column could be lost. The data in that column will be cast from `ByteA` to `VarChar(64)`.

*/
-- AlterTable
ALTER TABLE "content_list" ALTER COLUMN "h_ct" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "h_data" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "h_k" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "ct_r" SET DATA TYPE VARCHAR(64);
