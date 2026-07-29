-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryEventType" ADD VALUE 'SALE_DELETE_IN';
ALTER TYPE "InventoryEventType" ADD VALUE 'SALE_RESTORE_OUT';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "max_products" INTEGER;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" INTEGER;

-- CreateIndex
CREATE INDEX "sales_consumer_id_deleted_at_idx" ON "sales"("consumer_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
