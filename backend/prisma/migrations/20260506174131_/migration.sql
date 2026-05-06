/*
  Warnings:

  - The values [DEPOSIT] on the enum `PaymentMethodEnum` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `daily_sale_objective` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `calculation_details` on the `salary_payments` table. All the data in the column will be lost.
  - You are about to drop the column `discount_amount` on the `sale_items` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `sale_payments` table. All the data in the column will be lost.
  - You are about to drop the column `change_amount` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `discount_type` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the `expenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `variant_attributes` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentTypeEnum" AS ENUM ('BANGLADESH_BANK', 'SONALI_BANK_LIMITED', 'JANATA_BANK_LIMITED', 'AGRANI_BANK_LIMITED', 'RUPALI_BANK_LIMITED', 'BANGLADESH_KRISHI_BANK', 'RAJSHAHI_KRISHI_UNNAYAN_BANK', 'BANGLADESH_DEVELOPMENT_BANK_LIMITED', 'BASIC_BANK_LIMITED', 'ANSAR_VDP_UNNAYAN_BANK', 'KARMASANGSTHAN_BANK', 'AB_BANK_LIMITED', 'AL_ARAFAH_ISLAMI_BANK_LIMITED', 'BANGLADESH_COMMERCE_BANK_LIMITED', 'BANK_ASIA_LIMITED', 'BRAC_BANK_LIMITED', 'DHAKA_BANK_LIMITED', 'DUTCH_BANGLA_BANK_LIMITED', 'EASTERN_BANK_LIMITED', 'EXIM_BANK_LIMITED', 'FIRST_SECURITY_ISLAMI_BANK_LIMITED', 'ICB_ISLAMIC_BANK_LIMITED', 'IFIC_BANK_LIMITED', 'ISLAMI_BANK_BANGLADESH_LIMITED', 'JAMUNA_BANK_LIMITED', 'MEGHNA_BANK_LIMITED', 'MERCANTILE_BANK_LIMITED', 'MIDLAND_BANK_LIMITED', 'MUTUAL_TRUST_BANK_LIMITED', 'NATIONAL_BANK_LIMITED', 'NRB_BANK_LIMITED', 'NATIONAL_CREDIT_AND_COMMERCE_BANK_LIMITED', 'NRB_COMMERCIAL_BANK_LIMITED', 'ONE_BANK_LIMITED', 'PREMIER_BANK_LIMITED', 'PRIME_BANK_LIMITED', 'PUBALI_BANK_LIMITED', 'SHAHJALAL_ISLAMI_BANK_LIMITED', 'SOCIAL_ISLAMI_BANK_LIMITED', 'SOUTH_BANGLA_AGRICULTURE_AND_COMMERCE_BANK_LIMITED', 'SOUTHEAST_BANK_LIMITED', 'STANDARD_BANK_LIMITED', 'THE_CITY_BANK_LIMITED', 'THE_FARMERS_BANK_LIMITED', 'TRUST_BANK_LIMITED', 'UNION_BANK_LIMITED', 'UNITED_COMMERCIAL_BANK_LIMITED', 'UTTARA_BANK_LIMITED', 'BANK_AL_FALAH_LIMITED', 'CITIBANK_N_A', 'COMMERCIAL_BANK_OF_CEYLON_LIMITED', 'HABIB_BANK_LIMITED', 'NATIONAL_BANK_OF_PAKISTAN', 'STANDARD_CHARTERED_BANK', 'STATE_BANK_OF_INDIA', 'THE_HONGKONG_AND_SHANGHAI_BANKING_CORPORATION_LTD', 'WOORI_BANK', 'ROCKET', 'BKASH', 'MYCASH', 'ISLAMI_BANK_MCASH', 'TRUST_AXIATA_PAY_TAP', 'FIRSTCASH', 'UPAY', 'OK_WALLET', 'RUPALI_BANK', 'TELECASH', 'ISLAMIC_WALLET', 'MEGHNA_PAY', 'NAGAD');

-- CreateEnum
CREATE TYPE "OnlineOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT', 'EXCHANGE_OUT');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethodEnum_new" AS ENUM ('CASH', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY', 'MFS', 'CREDIT', 'EXCHANGE');
ALTER TABLE "sale_payments" ALTER COLUMN "payment_method" TYPE "PaymentMethodEnum_new" USING ("payment_method"::text::"PaymentMethodEnum_new");
ALTER TABLE "return_payments" ALTER COLUMN "payment_method" TYPE "PaymentMethodEnum_new" USING ("payment_method"::text::"PaymentMethodEnum_new");
ALTER TABLE "salary_payments" ALTER COLUMN "payment_method" TYPE "PaymentMethodEnum_new" USING ("payment_method"::text::"PaymentMethodEnum_new");
ALTER TYPE "PaymentMethodEnum" RENAME TO "PaymentMethodEnum_old";
ALTER TYPE "PaymentMethodEnum_new" RENAME TO "PaymentMethodEnum";
DROP TYPE "PaymentMethodEnum_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "expense_payments" DROP CONSTRAINT "expense_payments_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_approved_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "variant_attributes" DROP CONSTRAINT "variant_attributes_consumerId_fkey";

-- DropForeignKey
ALTER TABLE "variant_attributes" DROP CONSTRAINT "variant_attributes_variant_id_fkey";

-- DropIndex
DROP INDEX "advances_approved_by_user_id_idx";

-- DropIndex
DROP INDEX "advances_consumer_id_idx";

-- DropIndex
DROP INDEX "advances_request_date_idx";

-- DropIndex
DROP INDEX "advances_status_idx";

-- DropIndex
DROP INDEX "advances_user_id_idx";

-- DropIndex
DROP INDEX "attendances_consumer_id_idx";

-- DropIndex
DROP INDEX "attendances_date_idx";

-- DropIndex
DROP INDEX "attendances_status_idx";

-- DropIndex
DROP INDEX "branches_name_idx";

-- DropIndex
DROP INDEX "brands_name_idx";

-- DropIndex
DROP INDEX "categories_name_idx";

-- DropIndex
DROP INDEX "consumers_company_name_idx";

-- DropIndex
DROP INDEX "consumers_phone_idx";

-- DropIndex
DROP INDEX "customer_rewards_points_consumer_id_idx";

-- DropIndex
DROP INDEX "customer_rewards_points_customer_id_idx";

-- DropIndex
DROP INDEX "customer_rewards_points_total_points_idx";

-- DropIndex
DROP INDEX "customers_consumer_id_idx";

-- DropIndex
DROP INDEX "customers_email_idx";

-- DropIndex
DROP INDEX "customers_name_idx";

-- DropIndex
DROP INDEX "customers_phone_idx";

-- DropIndex
DROP INDEX "deductions_consumer_id_idx";

-- DropIndex
DROP INDEX "deductions_date_idx";

-- DropIndex
DROP INDEX "deductions_status_idx";

-- DropIndex
DROP INDEX "deductions_type_idx";

-- DropIndex
DROP INDEX "deductions_user_id_idx";

-- DropIndex
DROP INDEX "inventory_adjustments_branch_id_idx";

-- DropIndex
DROP INDEX "inventory_adjustments_created_by_user_id_idx";

-- DropIndex
DROP INDEX "inventory_batches_branch_id_idx";

-- DropIndex
DROP INDEX "inventory_batches_quantity_idx";

-- DropIndex
DROP INDEX "inventory_batches_variant_id_branch_id_idx";

-- DropIndex
DROP INDEX "inventory_transfer_items_batch_id_idx";

-- DropIndex
DROP INDEX "inventory_transfers_created_at_idx";

-- DropIndex
DROP INDEX "inventory_transfers_destination_branch_id_idx";

-- DropIndex
DROP INDEX "inventory_transfers_source_branch_id_idx";

-- DropIndex
DROP INDEX "leaves_consumer_id_idx";

-- DropIndex
DROP INDEX "leaves_leave_type_idx";

-- DropIndex
DROP INDEX "leaves_start_date_idx";

-- DropIndex
DROP INDEX "leaves_status_idx";

-- DropIndex
DROP INDEX "leaves_user_id_idx";

-- DropIndex
DROP INDEX "overtimes_approved_by_user_id_idx";

-- DropIndex
DROP INDEX "overtimes_consumer_id_idx";

-- DropIndex
DROP INDEX "overtimes_date_idx";

-- DropIndex
DROP INDEX "overtimes_status_idx";

-- DropIndex
DROP INDEX "overtimes_user_id_idx";

-- DropIndex
DROP INDEX "plans_created_at_idx";

-- DropIndex
DROP INDEX "plans_price_idx";

-- DropIndex
DROP INDEX "product_variants_name_idx";

-- DropIndex
DROP INDEX "product_variants_regular_price_idx";

-- DropIndex
DROP INDEX "products_brand_id_idx";

-- DropIndex
DROP INDEX "products_category_id_idx";

-- DropIndex
DROP INDEX "products_name_idx";

-- DropIndex
DROP INDEX "promotions_consumer_id_is_active_idx";

-- DropIndex
DROP INDEX "promotions_start_date_end_date_idx";

-- DropIndex
DROP INDEX "return_exchanges_batch_id_idx";

-- DropIndex
DROP INDEX "return_items_batch_id_idx";

-- DropIndex
DROP INDEX "return_payments_payment_method_idx";

-- DropIndex
DROP INDEX "returns_consumer_id_idx";

-- DropIndex
DROP INDEX "returns_exchange_sale_id_idx";

-- DropIndex
DROP INDEX "returns_return_date_idx";

-- DropIndex
DROP INDEX "rewards_point_transactions_consumer_id_idx";

-- DropIndex
DROP INDEX "rewards_point_transactions_created_at_idx";

-- DropIndex
DROP INDEX "rewards_point_transactions_customer_id_idx";

-- DropIndex
DROP INDEX "rewards_point_transactions_sale_id_idx";

-- DropIndex
DROP INDEX "rewards_point_transactions_type_idx";

-- DropIndex
DROP INDEX "roles_hierarchy_level_idx";

-- DropIndex
DROP INDEX "salary_increments_created_by_user_id_idx";

-- DropIndex
DROP INDEX "salary_increments_effective_date_idx";

-- DropIndex
DROP INDEX "salary_increments_user_id_idx";

-- DropIndex
DROP INDEX "salary_payments_consumer_id_idx";

-- DropIndex
DROP INDEX "salary_payments_payment_date_idx";

-- DropIndex
DROP INDEX "salary_payments_period_end_idx";

-- DropIndex
DROP INDEX "salary_payments_period_start_idx";

-- DropIndex
DROP INDEX "salary_payments_user_id_idx";

-- DropIndex
DROP INDEX "salary_structures_effective_from_idx";

-- DropIndex
DROP INDEX "salary_structures_is_active_idx";

-- DropIndex
DROP INDEX "salary_structures_user_id_idx";

-- DropIndex
DROP INDEX "sales_branch_id_idx";

-- DropIndex
DROP INDEX "sales_consumer_id_idx";

-- DropIndex
DROP INDEX "sales_sale_date_idx";

-- DropIndex
DROP INDEX "sales_sale_type_idx";

-- DropIndex
DROP INDEX "super_admins_name_idx";

-- DropIndex
DROP INDEX "tags_name_idx";

-- DropIndex
DROP INDEX "units_name_idx";

-- DropIndex
DROP INDEX "users_consumer_id_role_id_idx";

-- DropIndex
DROP INDEX "users_created_at_idx";

-- DropIndex
DROP INDEX "users_name_idx";

-- DropIndex
DROP INDEX "vendors_email_idx";

-- DropIndex
DROP INDEX "vendors_name_idx";

-- DropIndex
DROP INDEX "vendors_phone_idx";

-- AlterTable
ALTER TABLE "consumers" ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "inventory_adjustments" ADD COLUMN     "adjustment_type" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "inventory_transfer_items" ADD COLUMN     "dest_batch_id" INTEGER;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "daily_sale_objective" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "daily_sale_objective";

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "auto_apply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brand_id" INTEGER,
ADD COLUMN     "cap_discount_amount" DECIMAL(10,2),
ADD COLUMN     "cap_quantity" INTEGER,
ADD COLUMN     "created_by_user_id" INTEGER,
ADD COLUMN     "customer_usage_daily_reset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customer_usage_limit" INTEGER,
ADD COLUMN     "limit_per_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_discount_amount" DECIMAL(10,2),
ADD COLUMN     "member_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "min_quantity" INTEGER DEFAULT 1,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'SINGLE_PRODUCT',
ADD COLUMN     "usage_limit" INTEGER;

-- AlterTable
ALTER TABLE "salary_payments" DROP COLUMN "calculation_details";

-- AlterTable
ALTER TABLE "sale_items" DROP COLUMN "discount_amount",
ADD COLUMN     "applied_promotion_id" INTEGER,
ADD COLUMN     "average_discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotion_discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sold_unit_price" DECIMAL(10,2),
ADD COLUMN     "special_discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_payments" DROP COLUMN "notes",
ADD COLUMN     "payment_type" "PaymentTypeEnum";

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "change_amount",
DROP COLUMN "discount_type",
ADD COLUMN     "is_online_order" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "online_order_status" TEXT DEFAULT 'PENDING',
ADD COLUMN     "promotion_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "promotion_id" INTEGER,
ADD COLUMN     "served_by_id" INTEGER;

-- DropTable
DROP TABLE "expenses";

-- DropTable
DROP TABLE "variant_attributes";

-- CreateTable
CREATE TABLE "VariantAttribute" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "VariantAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_audit_logs" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "event_type" "InventoryEventType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "reference_id" INTEGER,
    "reference_type" TEXT,
    "notes" TEXT,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryBatchId" INTEGER,

    CONSTRAINT "inventory_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "receipt_url" TEXT,
    "include_in_salary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantAttribute_consumer_id_name_idx" ON "VariantAttribute"("consumer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VariantAttribute_variant_id_name_key" ON "VariantAttribute"("variant_id", "name");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_variant_id_branch_id_idx" ON "inventory_audit_logs"("variant_id", "branch_id");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_batch_id_idx" ON "inventory_audit_logs"("batch_id");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_consumer_id_created_at_idx" ON "inventory_audit_logs"("consumer_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_event_type_created_at_idx" ON "inventory_audit_logs"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "inventory_audit_logs_reference_type_reference_id_idx" ON "inventory_audit_logs"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "Expense_user_id_date_idx" ON "Expense"("user_id", "date");

-- CreateIndex
CREATE INDEX "Expense_consumer_id_status_idx" ON "Expense"("consumer_id", "status");

-- CreateIndex
CREATE INDEX "Expense_consumer_id_include_in_salary_status_idx" ON "Expense"("consumer_id", "include_in_salary", "status");

-- CreateIndex
CREATE INDEX "advances_user_id_status_idx" ON "advances"("user_id", "status");

-- CreateIndex
CREATE INDEX "advances_consumer_id_status_idx" ON "advances"("consumer_id", "status");

-- CreateIndex
CREATE INDEX "attendances_consumer_id_date_idx" ON "attendances"("consumer_id", "date");

-- CreateIndex
CREATE INDEX "attendances_consumer_id_status_idx" ON "attendances"("consumer_id", "status");

-- CreateIndex
CREATE INDEX "customer_rewards_points_consumer_id_total_points_idx" ON "customer_rewards_points"("consumer_id", "total_points");

-- CreateIndex
CREATE INDEX "customers_consumer_id_name_idx" ON "customers"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "customers_consumer_id_email_idx" ON "customers"("consumer_id", "email");

-- CreateIndex
CREATE INDEX "deductions_user_id_status_idx" ON "deductions"("user_id", "status");

-- CreateIndex
CREATE INDEX "deductions_consumer_id_date_idx" ON "deductions"("consumer_id", "date");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_dest_batch_id_idx" ON "inventory_transfer_items"("dest_batch_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_source_branch_id_created_at_idx" ON "inventory_transfers"("source_branch_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transfers_destination_branch_id_created_at_idx" ON "inventory_transfers"("destination_branch_id", "created_at");

-- CreateIndex
CREATE INDEX "leaves_user_id_start_date_idx" ON "leaves"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "leaves_consumer_id_status_idx" ON "leaves"("consumer_id", "status");

-- CreateIndex
CREATE INDEX "overtimes_user_id_date_idx" ON "overtimes"("user_id", "date");

-- CreateIndex
CREATE INDEX "overtimes_consumer_id_status_idx" ON "overtimes"("consumer_id", "status");

-- CreateIndex
CREATE INDEX "products_consumer_id_category_id_idx" ON "products"("consumer_id", "category_id");

-- CreateIndex
CREATE INDEX "products_consumer_id_brand_id_idx" ON "products"("consumer_id", "brand_id");

-- CreateIndex
CREATE INDEX "promotions_consumer_id_is_active_start_date_end_date_idx" ON "promotions"("consumer_id", "is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "promotions_brand_id_idx" ON "promotions"("brand_id");

-- CreateIndex
CREATE INDEX "returns_consumer_id_return_date_idx" ON "returns"("consumer_id", "return_date");

-- CreateIndex
CREATE INDEX "rewards_point_transactions_customer_id_created_at_idx" ON "rewards_point_transactions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "rewards_point_transactions_consumer_id_type_idx" ON "rewards_point_transactions"("consumer_id", "type");

-- CreateIndex
CREATE INDEX "salary_increments_user_id_effective_date_idx" ON "salary_increments"("user_id", "effective_date");

-- CreateIndex
CREATE INDEX "salary_payments_user_id_period_start_idx" ON "salary_payments"("user_id", "period_start");

-- CreateIndex
CREATE INDEX "salary_payments_consumer_id_payment_date_idx" ON "salary_payments"("consumer_id", "payment_date");

-- CreateIndex
CREATE INDEX "salary_structures_user_id_is_active_idx" ON "salary_structures"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "sales_consumer_id_sale_date_idx" ON "sales"("consumer_id", "sale_date");

-- CreateIndex
CREATE INDEX "sales_consumer_id_branch_id_sale_date_idx" ON "sales"("consumer_id", "branch_id", "sale_date");

-- CreateIndex
CREATE INDEX "sales_is_online_order_online_order_status_idx" ON "sales"("is_online_order", "online_order_status");

-- CreateIndex
CREATE INDEX "users_consumer_id_employment_status_idx" ON "users"("consumer_id", "employment_status");

-- CreateIndex
CREATE INDEX "vendors_consumer_id_email_idx" ON "vendors"("consumer_id", "email");

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttribute" ADD CONSTRAINT "VariantAttribute_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_audit_logs" ADD CONSTRAINT "inventory_audit_logs_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_served_by_id_fkey" FOREIGN KEY ("served_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
