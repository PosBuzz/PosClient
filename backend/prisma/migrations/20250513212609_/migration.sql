/*
  Warnings:

  - A unique constraint covering the columns `[name,consumer_id]` on the table `Branch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,consumer_id]` on the table `Brand` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,consumer_id]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,consumer_id]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,consumer_id]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `consumer_id` to the `Branch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumer_id` to the `Brand` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumer_id` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumer_id` to the `Tag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consumer_id` to the `Unit` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Tag_name_key";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "consumer_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "consumer_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "consumer_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "consumer_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "consumer_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Branch_consumer_id_idx" ON "Branch"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_consumer_id_key" ON "Branch"("name", "consumer_id");

-- CreateIndex
CREATE INDEX "Brand_consumer_id_idx" ON "Brand"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_consumer_id_key" ON "Brand"("name", "consumer_id");

-- CreateIndex
CREATE INDEX "Category_consumer_id_idx" ON "Category"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_consumer_id_key" ON "Category"("name", "consumer_id");

-- CreateIndex
CREATE INDEX "Tag_consumer_id_idx" ON "Tag"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_consumer_id_key" ON "Tag"("name", "consumer_id");

-- CreateIndex
CREATE INDEX "Unit_consumer_id_idx" ON "Unit"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_consumer_id_key" ON "Unit"("name", "consumer_id");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
