-- CreateIndex
CREATE UNIQUE INDEX "content_registrations_content_id_key" ON "content_registrations"("content_id");

-- AddForeignKey
ALTER TABLE "content_registrations" ADD CONSTRAINT "content_registrations_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;
