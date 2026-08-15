CREATE TABLE "operational_costs" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "incurred_on" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "operational_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operational_costs_consumer_id_incurred_on_idx" ON "operational_costs"("consumer_id", "incurred_on");
CREATE INDEX "operational_costs_consumer_id_branch_id_incurred_on_idx" ON "operational_costs"("consumer_id", "branch_id", "incurred_on");
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operational_costs" ADD CONSTRAINT "operational_costs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
