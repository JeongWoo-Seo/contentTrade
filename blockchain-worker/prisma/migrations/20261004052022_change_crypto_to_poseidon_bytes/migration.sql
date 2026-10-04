/*
  Warnings:

  - You are about to drop the column `content_hash` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `data_iv` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `encrypted_data_hash` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `encrypted_data_key` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `encryption_version` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `key_auth_tag` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `key_hash` on the `content_registration_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `key_iv` on the `content_registration_transactions` table. All the data in the column will be lost.
  - Added the required column `h_ct` to the `content_registration_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `h_data` to the `content_registration_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `h_k` to the `content_registration_transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "content_registration_transactions" DROP COLUMN "content_hash",
DROP COLUMN "data_iv",
DROP COLUMN "encrypted_data_hash",
DROP COLUMN "encrypted_data_key",
DROP COLUMN "encryption_version",
DROP COLUMN "key_auth_tag",
DROP COLUMN "key_hash",
DROP COLUMN "key_iv",
ADD COLUMN     "h_ct" BYTEA NOT NULL,
ADD COLUMN     "h_data" BYTEA NOT NULL,
ADD COLUMN     "h_k" BYTEA NOT NULL;
