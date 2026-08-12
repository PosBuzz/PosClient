-- DropForeignKey
ALTER TABLE "VariantAttribute" DROP CONSTRAINT "VariantAttribute_consumer_id_fkey";

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
