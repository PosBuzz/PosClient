/*
  Warnings:

  - Added the required column `name` to the `SuperAdmin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `SuperAdmin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SuperAdmin" ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "role_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "SuperAdminRole" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "SuperAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminPermission" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "SuperAdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminRolePermission" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "SuperAdminRolePermission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminPermission_action_key" ON "SuperAdminPermission"("action");

-- AddForeignKey
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "SuperAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdmin" ADD CONSTRAINT "SuperAdmin_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "SuperAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminRolePermission" ADD CONSTRAINT "SuperAdminRolePermission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "SuperAdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminRolePermission" ADD CONSTRAINT "SuperAdminRolePermission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "SuperAdminPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
