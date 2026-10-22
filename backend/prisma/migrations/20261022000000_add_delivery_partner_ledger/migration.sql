-- AlterEnum
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'DELIVERY_PARTNER';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cod_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cod_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "delivery_partner_id" INTEGER,
ADD COLUMN     "partner_settlement_id" INTEGER;

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "default_delivery_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "default_cod_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_settlements" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" "PaymentMethodEnum" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "settlement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,
    "voided_at" TIMESTAMP(3),
    "voided_by_id" INTEGER,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_partner_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_transactions" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "partner_id" INTEGER NOT NULL,
    "sale_id" INTEGER,
    "settlement_id" INTEGER,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_partner_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_consumer_id_name_key" ON "delivery_partners"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "delivery_partner_settlements_consumer_id_idx" ON "delivery_partner_settlements"("consumer_id");

-- CreateIndex
CREATE INDEX "delivery_partner_settlements_partner_id_settlement_date_idx" ON "delivery_partner_settlements"("partner_id", "settlement_date");

-- CreateIndex
CREATE INDEX "delivery_partner_transactions_consumer_id_idx" ON "delivery_partner_transactions"("consumer_id");

-- CreateIndex
CREATE INDEX "delivery_partner_transactions_partner_id_id_idx" ON "delivery_partner_transactions"("partner_id", "id");

-- CreateIndex
CREATE INDEX "delivery_partner_transactions_sale_id_idx" ON "delivery_partner_transactions"("sale_id");

-- CreateIndex
CREATE INDEX "delivery_partner_transactions_settlement_id_idx" ON "delivery_partner_transactions"("settlement_id");

-- CreateIndex
CREATE INDEX "sales_delivery_partner_id_partner_settlement_id_idx" ON "sales"("delivery_partner_id", "partner_settlement_id");

-- CreateIndex
CREATE INDEX "sales_partner_settlement_id_idx" ON "sales"("partner_settlement_id");

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_settlements" ADD CONSTRAINT "delivery_partner_settlements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "delivery_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_transactions" ADD CONSTRAINT "delivery_partner_transactions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "delivery_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_transactions" ADD CONSTRAINT "delivery_partner_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partner_transactions" ADD CONSTRAINT "delivery_partner_transactions_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "delivery_partner_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_partner_settlement_id_fkey" FOREIGN KEY ("partner_settlement_id") REFERENCES "delivery_partner_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every distinct free-text partner name an online order already carries
-- becomes a partner of that shop. Names that differ only by case or surrounding
-- spaces ("Pathao", " pathao ") become one partner, named by its first spelling.
-- Old orders are linked but get no ledger entries: their amounts were never
-- recorded, so no balance is invented for them.
INSERT INTO "delivery_partners" ("consumer_id", "name", "created_at", "updated_at")
SELECT DISTINCT ON ("consumer_id", lower(btrim("delivery_partner")))
       "consumer_id", btrim("delivery_partner"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "sales"
WHERE "delivery_partner" IS NOT NULL AND btrim("delivery_partner") <> ''
ORDER BY "consumer_id", lower(btrim("delivery_partner")), "id"
ON CONFLICT ("consumer_id", "name") DO NOTHING;

UPDATE "sales" s
SET "delivery_partner_id" = p."id", "delivery_partner" = p."name"
FROM "delivery_partners" p
WHERE p."consumer_id" = s."consumer_id"
  AND s."delivery_partner" IS NOT NULL
  AND lower(p."name") = lower(btrim(s."delivery_partner"));
