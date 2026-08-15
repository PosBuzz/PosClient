-- Physical storage location of a batch (shelf / bin / rack), e.g. "A-3-2".
-- Nullable: existing batches have no recorded location.
ALTER TABLE "inventory_batches" ADD COLUMN "location" TEXT;

CREATE INDEX "inventory_batches_location_idx" ON "inventory_batches"("location");
