-- Add explicit subscription coverage dates to each bill.
ALTER TABLE "billing_histories"
ADD COLUMN "billing_from" TIMESTAMP(3),
ADD COLUMN "billing_till" TIMESTAMP(3);

-- One-time backfill: all historical bills represent one month of coverage.
-- Keep the original timestamp so existing locally-selected calendar dates do
-- not shift when the application displays them in its configured timezone.
UPDATE "billing_histories"
SET
  "billing_from" = "billing_date",
  "billing_till" = "billing_date" + INTERVAL '1 month' - INTERVAL '1 millisecond';

ALTER TABLE "billing_histories"
ALTER COLUMN "billing_from" SET NOT NULL,
ALTER COLUMN "billing_till" SET NOT NULL;

CREATE INDEX "billing_histories_consumer_id_billing_from_billing_till_idx"
ON "billing_histories"("consumer_id", "billing_from", "billing_till");

CREATE INDEX "billing_histories_billing_till_idx"
ON "billing_histories"("billing_till");
