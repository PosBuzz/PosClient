/*
  Warnings:

  - Added the required column `plan_id` to the `billing_histories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "billing_histories" ADD COLUMN     "plan_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "billing_histories" ADD CONSTRAINT "billing_histories_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
