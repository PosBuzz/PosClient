-- DropForeignKey
ALTER TABLE "ProductTag" DROP CONSTRAINT "ProductTag_tag_id_fkey";

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
