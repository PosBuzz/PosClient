/*
  Warnings:

  - You are about to drop the column `notes` on the `return_payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "vat_registration_number" TEXT;

-- AlterTable
ALTER TABLE "return_payments" DROP COLUMN "notes",
ADD COLUMN     "payment_type" "PaymentTypeEnum";

-- CreateTable
CREATE TABLE "receipt_pdf_settings" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER,

    CONSTRAINT "receipt_pdf_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "receipt_pdf_settings_consumer_id_branch_id_type_is_active_idx" ON "receipt_pdf_settings"("consumer_id", "branch_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "receipt_pdf_settings_consumer_id_type_is_active_idx" ON "receipt_pdf_settings"("consumer_id", "type", "is_active");

-- CreateIndex
CREATE INDEX "receipt_pdf_settings_branch_id_idx" ON "receipt_pdf_settings"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_pdf_settings_consumer_id_branch_id_name_type_key" ON "receipt_pdf_settings"("consumer_id", "branch_id", "name", "type");

-- AddForeignKey
ALTER TABLE "receipt_pdf_settings" ADD CONSTRAINT "receipt_pdf_settings_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_pdf_settings" ADD CONSTRAINT "receipt_pdf_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_pdf_settings" ADD CONSTRAINT "receipt_pdf_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
