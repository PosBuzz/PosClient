/*
  Warnings:

  - You are about to drop the column `product_id` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the column `tag` on the `Tag` table. All the data in the column will be lost.
  - You are about to drop the `branch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `brand` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productBranchPrice` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productSerial` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `promotional_price` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `unit` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_category_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_product_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_purchase_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "product" DROP CONSTRAINT "product_sale_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "productBranchPrice" DROP CONSTRAINT "productBranchPrice_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "productBranchPrice" DROP CONSTRAINT "productBranchPrice_product_id_fkey";

-- DropForeignKey
ALTER TABLE "productSerial" DROP CONSTRAINT "productSerial_product_id_fkey";

-- DropForeignKey
ALTER TABLE "productVariant" DROP CONSTRAINT "productVariant_product_id_fkey";

-- DropForeignKey
ALTER TABLE "promotional_price" DROP CONSTRAINT "promotional_price_product_id_fkey";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "product_id",
DROP COLUMN "tag",
ADD COLUMN     "name" TEXT NOT NULL;

-- DropTable
DROP TABLE "branch";

-- DropTable
DROP TABLE "brand";

-- DropTable
DROP TABLE "category";

-- DropTable
DROP TABLE "product";

-- DropTable
DROP TABLE "productBranchPrice";

-- DropTable
DROP TABLE "productSerial";

-- DropTable
DROP TABLE "productVariant";

-- DropTable
DROP TABLE "promotional_price";

-- DropTable
DROP TABLE "unit";

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "category_id" INTEGER NOT NULL,
    "brand_id" INTEGER NOT NULL,
    "product_unit_id" INTEGER NOT NULL,
    "sale_unit_id" INTEGER,
    "cost" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "wholesale_price" DOUBLE PRECISION,
    "purchase_unit_id" INTEGER,
    "image_url" TEXT,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "sell_online" BOOLEAN NOT NULL DEFAULT false,
    "daily_sale_objective" DOUBLE PRECISION,
    "alert_quantity" DOUBLE PRECISION,
    "product_tax" TEXT,
    "tax_method" "TaxMethod",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "option" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "item_code" TEXT,
    "cost" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBranchPrice" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ProductBranchPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSerial" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "serial" TEXT NOT NULL,

    CONSTRAINT "ProductSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionalPrice" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),

    CONSTRAINT "PromotionalPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "product_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("product_id","tag_id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSerial_serial_key" ON "ProductSerial"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionalPrice_product_id_key" ON "PromotionalPrice"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_product_unit_id_fkey" FOREIGN KEY ("product_unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sale_unit_id_fkey" FOREIGN KEY ("sale_unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_purchase_unit_id_fkey" FOREIGN KEY ("purchase_unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBranchPrice" ADD CONSTRAINT "ProductBranchPrice_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBranchPrice" ADD CONSTRAINT "ProductBranchPrice_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSerial" ADD CONSTRAINT "ProductSerial_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionalPrice" ADD CONSTRAINT "PromotionalPrice_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
