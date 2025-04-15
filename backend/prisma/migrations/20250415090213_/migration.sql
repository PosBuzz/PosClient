/*
  Warnings:

  - A unique constraint covering the columns `[consumer_id,billing_month]` on the table `BillingHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "BillingHistory_consumer_id_idx" ON "BillingHistory"("consumer_id");

-- CreateIndex
CREATE INDEX "BillingHistory_billing_month_idx" ON "BillingHistory"("billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "BillingHistory_consumer_id_billing_month_key" ON "BillingHistory"("consumer_id", "billing_month");

-- CreateIndex
CREATE INDEX "Role_consumer_id_idx" ON "Role"("consumer_id");

-- CreateIndex
CREATE INDEX "User_consumer_id_idx" ON "User"("consumer_id");
