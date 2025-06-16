/*
  Warnings:

  - You are about to drop the `Branch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Brand` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductBranchPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductSerial` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromotionalPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Unit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "Branch_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Brand" DROP CONSTRAINT "Brand_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_category_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_product_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_purchase_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_sale_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductBranchPrice" DROP CONSTRAINT "ProductBranchPrice_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductBranchPrice" DROP CONSTRAINT "ProductBranchPrice_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductSerial" DROP CONSTRAINT "ProductSerial_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductTag" DROP CONSTRAINT "ProductTag_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductTag" DROP CONSTRAINT "ProductTag_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_product_id_fkey";

-- DropForeignKey
ALTER TABLE "PromotionalPrice" DROP CONSTRAINT "PromotionalPrice_product_id_fkey";

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_consumer_id_fkey";

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Branch";

-- DropTable
DROP TABLE "Brand";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductBranchPrice";

-- DropTable
DROP TABLE "ProductSerial";

-- DropTable
DROP TABLE "ProductTag";

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "PromotionalPrice";

-- DropTable
DROP TABLE "Tag";

-- DropTable
DROP TABLE "Unit";

-- DropEnum
DROP TYPE "BarcodeSymbology";

-- DropEnum
DROP TYPE "ProductType";

-- DropEnum
DROP TYPE "TaxMethod";

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "category_id" INTEGER,
    "brand_id" INTEGER,
    "has_variants" BOOLEAN NOT NULL DEFAULT false,
    "tax_method" TEXT NOT NULL DEFAULT 'exclusive',
    "tax" INTEGER NOT NULL DEFAULT 0,
    "daily_sale_objective" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_serials" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "serial_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "batch_id" INTEGER,
    "sold_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "regular_price" DECIMAL(10,2) NOT NULL,
    "wholesale_price" DECIMAL(10,2),
    "sale_unit_id" INTEGER NOT NULL,
    "purchase_unit_id" INTEGER NOT NULL,
    "warranty_period" INTEGER,
    "image" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "alert_quantity" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_on_products" (
    "product_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "tag_on_products_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_warehouse" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost_price" DECIMAL(10,2) NOT NULL,
    "vendor_id" INTEGER,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" SERIAL NOT NULL,
    "source_branch_id" INTEGER NOT NULL,
    "destination_branch_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfer_items" (
    "id" SERIAL NOT NULL,
    "transfer_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_attributes" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "consumerId" INTEGER,

    CONSTRAINT "variant_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "regular_price" DECIMAL(10,2) NOT NULL,
    "wholesale_price" DECIMAL(10,2),
    "effective_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "min_purchase" DECIMAL(10,2),
    "branch_specific" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_products" (
    "promotion_id" INTEGER NOT NULL,
    "variant_id" INTEGER NOT NULL,

    CONSTRAINT "promotion_products_pkey" PRIMARY KEY ("promotion_id","variant_id")
);

-- CreateTable
CREATE TABLE "promotion_branches" (
    "promotion_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,

    CONSTRAINT "promotion_branches_pkey" PRIMARY KEY ("promotion_id","branch_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_consumer_id_idx" ON "products"("consumer_id");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_consumer_id_name_idx" ON "products"("consumer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_consumer_id_code_key" ON "products"("consumer_id", "code");

-- CreateIndex
CREATE INDEX "product_serials_variant_id_status_idx" ON "product_serials"("variant_id", "status");

-- CreateIndex
CREATE INDEX "product_serials_serial_number_idx" ON "product_serials"("serial_number");

-- CreateIndex
CREATE UNIQUE INDEX "product_serials_variant_id_serial_number_key" ON "product_serials"("variant_id", "serial_number");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_variants_name_idx" ON "product_variants"("name");

-- CreateIndex
CREATE INDEX "product_variants_sku_idx" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_barcode_idx" ON "product_variants"("barcode");

-- CreateIndex
CREATE INDEX "product_variants_product_id_name_idx" ON "product_variants"("product_id", "name");

-- CreateIndex
CREATE INDEX "product_variants_regular_price_idx" ON "product_variants"("regular_price");

-- CreateIndex
CREATE INDEX "units_consumer_id_idx" ON "units"("consumer_id");

-- CreateIndex
CREATE INDEX "units_name_idx" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "units_consumer_id_name_key" ON "units"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "categories_consumer_id_idx" ON "categories"("consumer_id");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_consumer_id_name_key" ON "categories"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "brands_consumer_id_idx" ON "brands"("consumer_id");

-- CreateIndex
CREATE INDEX "brands_name_idx" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_consumer_id_name_key" ON "brands"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "tags_consumer_id_idx" ON "tags"("consumer_id");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_consumer_id_name_key" ON "tags"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "tag_on_products_product_id_idx" ON "tag_on_products"("product_id");

-- CreateIndex
CREATE INDEX "tag_on_products_tag_id_idx" ON "tag_on_products"("tag_id");

-- CreateIndex
CREATE INDEX "branches_consumer_id_idx" ON "branches"("consumer_id");

-- CreateIndex
CREATE INDEX "branches_name_idx" ON "branches"("name");

-- CreateIndex
CREATE INDEX "branches_is_main_idx" ON "branches"("is_main");

-- CreateIndex
CREATE INDEX "branches_is_warehouse_idx" ON "branches"("is_warehouse");

-- CreateIndex
CREATE UNIQUE INDEX "branches_consumer_id_name_key" ON "branches"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "inventory_batches_variant_id_idx" ON "inventory_batches"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_batches_branch_id_idx" ON "inventory_batches"("branch_id");

-- CreateIndex
CREATE INDEX "inventory_batches_vendor_id_idx" ON "inventory_batches"("vendor_id");

-- CreateIndex
CREATE INDEX "inventory_batches_variant_id_branch_id_idx" ON "inventory_batches"("variant_id", "branch_id");

-- CreateIndex
CREATE INDEX "inventory_batches_batch_number_idx" ON "inventory_batches"("batch_number");

-- CreateIndex
CREATE INDEX "inventory_batches_expiry_date_idx" ON "inventory_batches"("expiry_date");

-- CreateIndex
CREATE INDEX "inventory_batches_quantity_idx" ON "inventory_batches"("quantity");

-- CreateIndex
CREATE INDEX "inventory_batches_created_at_idx" ON "inventory_batches"("created_at");

-- CreateIndex
CREATE INDEX "inventory_batches_variant_id_branch_id_quantity_idx" ON "inventory_batches"("variant_id", "branch_id", "quantity");

-- CreateIndex
CREATE INDEX "inventory_transfers_source_branch_id_idx" ON "inventory_transfers"("source_branch_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_destination_branch_id_idx" ON "inventory_transfers"("destination_branch_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers"("status");

-- CreateIndex
CREATE INDEX "inventory_transfers_created_by_user_id_idx" ON "inventory_transfers"("created_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_transfers_created_at_idx" ON "inventory_transfers"("created_at");

-- CreateIndex
CREATE INDEX "inventory_transfers_status_created_at_idx" ON "inventory_transfers"("status", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_transfer_id_idx" ON "inventory_transfer_items"("transfer_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_batch_id_idx" ON "inventory_transfer_items"("batch_id");

-- CreateIndex
CREATE INDEX "inventory_transfer_items_transfer_id_batch_id_idx" ON "inventory_transfer_items"("transfer_id", "batch_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_variant_id_idx" ON "inventory_adjustments"("variant_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_branch_id_idx" ON "inventory_adjustments"("branch_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_batch_id_idx" ON "inventory_adjustments"("batch_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_created_by_user_id_idx" ON "inventory_adjustments"("created_by_user_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_created_at_idx" ON "inventory_adjustments"("created_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_variant_id_branch_id_idx" ON "inventory_adjustments"("variant_id", "branch_id");

-- CreateIndex
CREATE INDEX "vendors_consumer_id_idx" ON "vendors"("consumer_id");

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendors_email_idx" ON "vendors"("email");

-- CreateIndex
CREATE INDEX "vendors_phone_idx" ON "vendors"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_consumer_id_name_key" ON "vendors"("consumer_id", "name");

-- CreateIndex
CREATE INDEX "variant_attributes_variant_id_idx" ON "variant_attributes"("variant_id");

-- CreateIndex
CREATE INDEX "variant_attributes_name_idx" ON "variant_attributes"("name");

-- CreateIndex
CREATE INDEX "variant_attributes_value_idx" ON "variant_attributes"("value");

-- CreateIndex
CREATE INDEX "variant_attributes_consumerId_idx" ON "variant_attributes"("consumerId");

-- CreateIndex
CREATE UNIQUE INDEX "variant_attributes_variant_id_name_key" ON "variant_attributes"("variant_id", "name");

-- CreateIndex
CREATE INDEX "price_history_variant_id_effective_date_idx" ON "price_history"("variant_id", "effective_date");

-- CreateIndex
CREATE INDEX "promotions_consumer_id_is_active_idx" ON "promotions"("consumer_id", "is_active");

-- CreateIndex
CREATE INDEX "promotions_start_date_end_date_idx" ON "promotions"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "promotion_products_promotion_id_idx" ON "promotion_products"("promotion_id");

-- CreateIndex
CREATE INDEX "promotion_products_variant_id_idx" ON "promotion_products"("variant_id");

-- CreateIndex
CREATE INDEX "promotion_branches_promotion_id_idx" ON "promotion_branches"("promotion_id");

-- CreateIndex
CREATE INDEX "promotion_branches_branch_id_idx" ON "promotion_branches"("branch_id");

-- CreateIndex
CREATE INDEX "permissions_action_idx" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "plan_permissions_plan_id_idx" ON "plan_permissions"("plan_id");

-- CreateIndex
CREATE INDEX "plan_permissions_permission_id_idx" ON "plan_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "plans_name_idx" ON "plans"("name");

-- CreateIndex
CREATE INDEX "plans_price_idx" ON "plans"("price");

-- CreateIndex
CREATE INDEX "plans_created_at_idx" ON "plans"("created_at");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "super_admin_permissions_action_idx" ON "super_admin_permissions"("action");

-- CreateIndex
CREATE INDEX "super_admin_role_permissions_role_id_idx" ON "super_admin_role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "super_admin_role_permissions_permission_id_idx" ON "super_admin_role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "super_admin_roles_name_idx" ON "super_admin_roles"("name");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users"("name");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_consumer_id_role_id_idx" ON "users"("consumer_id", "role_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_serials" ADD CONSTRAINT "product_serials_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_sale_unit_id_fkey" FOREIGN KEY ("sale_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_on_products" ADD CONSTRAINT "tag_on_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_on_products" ADD CONSTRAINT "tag_on_products_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_branch_id_fkey" FOREIGN KEY ("destination_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_attributes" ADD CONSTRAINT "variant_attributes_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_branches" ADD CONSTRAINT "promotion_branches_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_branches" ADD CONSTRAINT "promotion_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
