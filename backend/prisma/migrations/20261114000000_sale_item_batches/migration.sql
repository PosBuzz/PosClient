-- One sale line can be filled from several batches while still showing as one row
CREATE TABLE "sale_item_batches" (
    "id" SERIAL NOT NULL,
    "sale_item_id" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "quantity" INTEGER NOT NULL,
    "returned_quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_item_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_item_batches_sale_item_id_idx" ON "sale_item_batches"("sale_item_id");
CREATE INDEX "sale_item_batches_batch_id_idx" ON "sale_item_batches"("batch_id");

ALTER TABLE "sale_item_batches" ADD CONSTRAINT "sale_item_batches_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_item_batches" ADD CONSTRAINT "sale_item_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing lines used exactly one batch; keep what has already been returned from it
INSERT INTO "sale_item_batches" ("sale_item_id", "batch_id", "quantity", "returned_quantity")
SELECT si."id", si."batch_id", si."quantity",
       COALESCE((SELECT SUM(ri."quantity") FROM "return_items" ri WHERE ri."sale_item_id" = si."id"), 0)
FROM "sale_items" si
WHERE si."batch_id" IS NOT NULL;
