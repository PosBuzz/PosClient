-- AlterTable
ALTER TABLE "consumers" ADD COLUMN     "delete_reason" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" INTEGER;

-- CreateIndex
CREATE INDEX "consumers_deleted_at_idx" ON "consumers"("deleted_at");

-- AddForeignKey
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
