-- DropIndex
DROP INDEX "billing_histories_consumer_id_idx";

-- DropIndex
DROP INDEX "branches_consumer_id_idx";

-- DropIndex
DROP INDEX "branches_is_main_idx";

-- DropIndex
DROP INDEX "branches_is_warehouse_idx";

-- DropIndex
DROP INDEX "brands_consumer_id_idx";

-- DropIndex
DROP INDEX "categories_consumer_id_idx";

-- DropIndex
DROP INDEX "consumers_subdomain_idx";

-- DropIndex
DROP INDEX "inventory_adjustments_variant_id_idx";

-- DropIndex
DROP INDEX "inventory_batches_variant_id_idx";

-- DropIndex
DROP INDEX "inventory_transfer_items_transfer_id_idx";

-- DropIndex
DROP INDEX "inventory_transfers_status_idx";

-- DropIndex
DROP INDEX "permissions_action_idx";

-- DropIndex
DROP INDEX "plan_permissions_plan_id_idx";

-- DropIndex
DROP INDEX "plans_name_idx";

-- DropIndex
DROP INDEX "product_variants_product_id_idx";

-- DropIndex
DROP INDEX "products_consumer_id_idx";

-- DropIndex
DROP INDEX "promotion_branches_promotion_id_idx";

-- DropIndex
DROP INDEX "promotion_products_promotion_id_idx";

-- DropIndex
DROP INDEX "role_permissions_role_id_idx";

-- DropIndex
DROP INDEX "roles_consumer_id_idx";

-- DropIndex
DROP INDEX "super_admin_permissions_action_idx";

-- DropIndex
DROP INDEX "super_admin_role_permissions_role_id_idx";

-- DropIndex
DROP INDEX "super_admin_roles_name_idx";

-- DropIndex
DROP INDEX "super_admins_email_idx";

-- DropIndex
DROP INDEX "tag_on_products_product_id_idx";

-- DropIndex
DROP INDEX "tags_consumer_id_idx";

-- DropIndex
DROP INDEX "units_consumer_id_idx";

-- DropIndex
DROP INDEX "users_consumer_id_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "variant_attributes_variant_id_idx";

-- DropIndex
DROP INDEX "vendors_consumer_id_idx";

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "customer_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_consumer_id_idx" ON "customers"("consumer_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
