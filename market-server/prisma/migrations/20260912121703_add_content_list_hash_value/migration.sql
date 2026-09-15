/*
  Warnings:

  - You are about to drop the column `auth_tag` on the `content_list` table. All the data in the column will be lost.
  - You are about to drop the column `iv` on the `content_list` table. All the data in the column will be lost.
  - Added the required column `data_iv` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encrypted_data_hash` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keyIv` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key_auth_tag` to the `content_list` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key_hash` to the `content_list` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "content_list" DROP COLUMN "auth_tag",
DROP COLUMN "iv",
ADD COLUMN     "data_iv" VARCHAR(255) NOT NULL,
ADD COLUMN     "encrypted_data_hash" VARCHAR(64) NOT NULL,
ADD COLUMN     "keyIv" VARCHAR(255) NOT NULL,
ADD COLUMN     "key_auth_tag" VARCHAR(255) NOT NULL,
ADD COLUMN     "key_hash" VARCHAR(64) NOT NULL;
