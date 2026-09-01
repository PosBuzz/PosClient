-- Repeatable, auditable one-way imports between tenant accounts.
CREATE TABLE "consumer_data_imports" (
    "id" SERIAL NOT NULL,
    "source_consumer_id" INTEGER NOT NULL,
    "target_consumer_id" INTEGER NOT NULL,
    "requested_by_id" INTEGER,
    "sections" JSONB NOT NULL,
    "duplicate_strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "summary" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consumer_data_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consumer_import_mappings" (
    "id" SERIAL NOT NULL,
    "source_consumer_id" INTEGER NOT NULL,
    "target_consumer_id" INTEGER NOT NULL,
    "entity_type" TEXT NOT NULL,
    "source_record_id" INTEGER NOT NULL,
    "target_record_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "consumer_import_mappings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consumer_data_imports_source_consumer_id_target_consumer_id_created_at_idx"
ON "consumer_data_imports"("source_consumer_id", "target_consumer_id", "created_at");
CREATE INDEX "consumer_data_imports_target_consumer_id_status_idx"
ON "consumer_data_imports"("target_consumer_id", "status");
CREATE INDEX "consumer_data_imports_requested_by_id_idx"
ON "consumer_data_imports"("requested_by_id");
CREATE UNIQUE INDEX "consumer_import_source_record_key"
ON "consumer_import_mappings"("source_consumer_id", "target_consumer_id", "entity_type", "source_record_id");
CREATE UNIQUE INDEX "consumer_import_target_record_key"
ON "consumer_import_mappings"("source_consumer_id", "target_consumer_id", "entity_type", "target_record_id");

ALTER TABLE "consumer_data_imports" ADD CONSTRAINT "consumer_data_imports_source_consumer_id_fkey"
FOREIGN KEY ("source_consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumer_data_imports" ADD CONSTRAINT "consumer_data_imports_target_consumer_id_fkey"
FOREIGN KEY ("target_consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumer_data_imports" ADD CONSTRAINT "consumer_data_imports_requested_by_id_fkey"
FOREIGN KEY ("requested_by_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consumer_import_mappings" ADD CONSTRAINT "consumer_import_mappings_source_consumer_id_fkey"
FOREIGN KEY ("source_consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consumer_import_mappings" ADD CONSTRAINT "consumer_import_mappings_target_consumer_id_fkey"
FOREIGN KEY ("target_consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A customer phone is tenant-owned. Global uniqueness prevented the same real
-- customer from existing in both accounts during an import.
DROP INDEX IF EXISTS "customers_phone_key";
CREATE UNIQUE INDEX "customers_consumer_id_phone_key" ON "customers"("consumer_id", "phone");
