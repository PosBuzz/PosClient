-- Return numbers are generated per consumer, so uniqueness must be scoped
-- per consumer as well (matching sales.sale_number).
DROP INDEX "returns_return_number_key";

CREATE UNIQUE INDEX "returns_return_number_consumer_id_key" ON "returns"("return_number", "consumer_id");
