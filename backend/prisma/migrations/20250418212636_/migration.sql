/*
  Warnings:

  - You are about to drop the column `name` on the `Consumer` table. All the data in the column will be lost.
  - Added the required column `company_name` to the `Consumer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Consumer" DROP COLUMN "name",
ADD COLUMN     "company_name" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Consumer_email_idx" ON "Consumer"("email");

-- CreateIndex
CREATE INDEX "Consumer_company_name_idx" ON "Consumer"("company_name");

-- CreateIndex
CREATE INDEX "Consumer_phone_idx" ON "Consumer"("phone");

-- CreateIndex
CREATE INDEX "Consumer_subdomain_idx" ON "Consumer"("subdomain");

-- CreateIndex
CREATE INDEX "Consumer_plan_id_idx" ON "Consumer"("plan_id");

-- CreateIndex
CREATE INDEX "SuperAdmin_email_idx" ON "SuperAdmin"("email");

-- CreateIndex
CREATE INDEX "SuperAdmin_name_idx" ON "SuperAdmin"("name");

-- CreateIndex
CREATE INDEX "SuperAdmin_role_id_idx" ON "SuperAdmin"("role_id");
