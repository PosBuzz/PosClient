-- AlterTable
ALTER TABLE "inventory_batches" ADD COLUMN     "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'paid';

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "payment_method" "PaymentMethodEnum" NOT NULL,
    "payment_type" "PaymentTypeEnum",
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_payments_batch_id_idx" ON "purchase_payments"("batch_id");

-- CreateIndex
CREATE INDEX "purchase_payments_payment_method_idx" ON "purchase_payments"("payment_method");

-- CreateIndex
CREATE INDEX "inventory_batches_payment_status_idx" ON "inventory_batches"("payment_status");

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
