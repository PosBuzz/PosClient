/*
  Warnings:

  - You are about to drop the `product_branch_price` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_serial` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_variant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "product_branch_price" DROP CONSTRAINT "product_branch_price_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "product_branch_price" DROP CONSTRAINT "product_branch_price_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_serial" DROP CONSTRAINT "product_serial_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_tag" DROP CONSTRAINT "product_tag_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variant" DROP CONSTRAINT "product_variant_product_id_fkey";

-- DropTable
DROP TABLE "product_branch_price";

-- DropTable
DROP TABLE "product_serial";

-- DropTable
DROP TABLE "product_tag";

-- DropTable
DROP TABLE "product_variant";

-- CreateTable
CREATE TABLE "productVariant" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "option" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "item_code" TEXT,
    "cost" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,

    CONSTRAINT "productVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productBranchPrice" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "productBranchPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productSerial" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "serial" TEXT NOT NULL,

    CONSTRAINT "productSerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productSerial_serial_key" ON "productSerial"("serial");

-- AddForeignKey
ALTER TABLE "productVariant" ADD CONSTRAINT "productVariant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productBranchPrice" ADD CONSTRAINT "productBranchPrice_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productBranchPrice" ADD CONSTRAINT "productBranchPrice_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productSerial" ADD CONSTRAINT "productSerial_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
