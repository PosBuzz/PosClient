/*
  Warnings:

  - The `tax_method` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `payment_method` on the `sales` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TaxMethod" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "PaymentMethodEnum" AS ENUM ('CASH', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY', 'MFS', 'DEPOSIT', 'CREDIT');

-- AlterTable
ALTER TABLE "products" DROP COLUMN "tax_method",
ADD COLUMN     "tax_method" "TaxMethod" NOT NULL DEFAULT 'EXCLUSIVE';

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "payment_method";

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "payment_method" "PaymentMethodEnum" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_payments_sale_id_idx" ON "sale_payments"("sale_id");

-- CreateIndex
CREATE INDEX "sale_payments_payment_method_idx" ON "sale_payments"("payment_method");

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
