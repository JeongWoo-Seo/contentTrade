-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'ACTIVE', 'SOLD_OUT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BuyStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(60) NOT NULL,
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
    "title" VARCHAR(200) NOT NULL,
    "author_id" INTEGER NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "iv" VARCHAR(255) NOT NULL,
    "auth_tag" VARCHAR(255) NOT NULL,
    "encrypted_data_key" TEXT NOT NULL,
    "encryption_version" INTEGER NOT NULL DEFAULT 1,
    "content_hash" VARCHAR(64),
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buy_history" (
    "id" SERIAL NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "content_id" INTEGER NOT NULL,
    "price" DECIMAL(18,0) NOT NULL,
    "status" "BuyStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" VARCHAR(66),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buy_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "content_list_author_id_idx" ON "content_list"("author_id");

-- CreateIndex
CREATE INDEX "content_list_status_idx" ON "content_list"("status");

-- CreateIndex
CREATE INDEX "content_list_created_at_idx" ON "content_list"("created_at");

-- CreateIndex
CREATE INDEX "buy_history_buyer_id_idx" ON "buy_history"("buyer_id");

-- CreateIndex
CREATE INDEX "buy_history_content_id_idx" ON "buy_history"("content_id");

-- CreateIndex
CREATE INDEX "buy_history_status_idx" ON "buy_history"("status");

-- CreateIndex
CREATE UNIQUE INDEX "buy_history_buyer_id_content_id_key" ON "buy_history"("buyer_id", "content_id");

-- AddForeignKey
ALTER TABLE "content_list" ADD CONSTRAINT "content_list_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_history" ADD CONSTRAINT "buy_history_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_history" ADD CONSTRAINT "buy_history_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_list"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
