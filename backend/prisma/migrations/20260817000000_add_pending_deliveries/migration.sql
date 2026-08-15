ALTER TABLE "inventory_batches" ADD COLUMN "reserved_quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN "is_delivery_later" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales" ADD COLUMN "delivery_status" TEXT;
ALTER TABLE "sales" ADD COLUMN "delivered_at" TIMESTAMP(3);

CREATE INDEX "sales_consumer_id_is_delivery_later_delivery_status_idx"
ON "sales"("consumer_id", "is_delivery_later", "delivery_status");
