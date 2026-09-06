/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "login_tk" VARCHAR(60) NOT NULL,
    "nickname" VARCHAR(100) NOT NULL,
    "sk_enc" VARCHAR(64) NOT NULL,
    "pk_own" VARCHAR(64) NOT NULL,
    "pk_enc" VARCHAR(64) NOT NULL,
    "addr" VARCHAR(64) NOT NULL,
    "eoa" VARCHAR(42) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_list" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "descript" TEXT NOT NULL,
    "h_ct" VARCHAR(64) NOT NULL,
    "h_data" VARCHAR(64) NOT NULL,
    "enc_key" VARCHAR(64) NOT NULL,
    "data_path" TEXT NOT NULL,
    "h_k" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_history" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "h_ct" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buy_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_nickname_key" ON "user"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "content_list_h_ct_key" ON "content_list"("h_ct");

-- CreateIndex
CREATE INDEX "content_list_user_id_idx" ON "content_list"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "buy_history_user_id_h_ct_key" ON "buy_history"("user_id", "h_ct");

-- AddForeignKey
ALTER TABLE "content_list" ADD CONSTRAINT "content_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_history" ADD CONSTRAINT "buy_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_history" ADD CONSTRAINT "buy_history_h_ct_fkey" FOREIGN KEY ("h_ct") REFERENCES "content_list"("h_ct") ON DELETE CASCADE ON UPDATE CASCADE;
