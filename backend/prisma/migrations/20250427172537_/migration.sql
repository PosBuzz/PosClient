/*
  Warnings:

  - You are about to drop the column `billing_month` on the `billing_histories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[consumer_id,billing_date]` on the table `billing_histories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billing_date` to the `billing_histories` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "billing_histories_billing_month_idx";

-- DropIndex
DROP INDEX "billing_histories_consumer_id_billing_month_key";

-- AlterTable
ALTER TABLE "billing_histories" DROP COLUMN "billing_month",
ADD COLUMN     "billing_date" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "billing_histories_billing_date_idx" ON "billing_histories"("billing_date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_histories_consumer_id_billing_date_key" ON "billing_histories"("consumer_id", "billing_date");
