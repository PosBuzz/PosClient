-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "converted_at" TIMESTAMP(3),
ADD COLUMN     "converted_to_sale_id" INTEGER;

-- CreateIndex
CREATE INDEX "sales_converted_to_sale_id_idx" ON "sales"("converted_to_sale_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_converted_to_sale_id_fkey" FOREIGN KEY ("converted_to_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
