/*
  Warnings:

  - Added the required column `updated_at` to the `BillingHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Consumer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `SuperAdmin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BillingHistory" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Consumer" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
