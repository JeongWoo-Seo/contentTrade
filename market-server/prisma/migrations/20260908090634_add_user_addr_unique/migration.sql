/*
  Warnings:

  - A unique constraint covering the columns `[addr]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_addr_key" ON "user"("addr");
