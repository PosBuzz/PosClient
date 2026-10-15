-- The index created in 20260901120000_add_consumer_data_imports had a name longer
-- than Postgres' 63-character identifier limit, so Postgres truncated it. Rename it
-- to the name Prisma derives from schema.prisma so `prisma migrate diff` is clean.
ALTER INDEX IF EXISTS "consumer_data_imports_source_consumer_id_target_consumer_id_cre"
  RENAME TO "consumer_data_imports_source_consumer_id_target_consumer_id_idx";
