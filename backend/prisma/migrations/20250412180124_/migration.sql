/*
  Warnings:

  - Added the required column `billing_month` to the `BillingHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BillingHistory" ADD COLUMN     "billing_month" TIMESTAMP(3) NOT NULL;
