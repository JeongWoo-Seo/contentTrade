/*
  Warnings:

  - Added the required column `user_id` to the `account_registration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "account_registration" ADD COLUMN     "user_id" INTEGER NOT NULL;
