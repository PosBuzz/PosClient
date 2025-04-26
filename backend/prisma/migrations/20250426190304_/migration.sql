/*
  Warnings:

  - You are about to drop the `BillingHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Consumer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuperAdmin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuperAdminPermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuperAdminRole` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuperAdminRolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "BillingHistory" DROP CONSTRAINT "BillingHistory_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "Consumer" DROP CONSTRAINT "Consumer_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "PlanPermission" DROP CONSTRAINT "PlanPermission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "PlanPermission" DROP CONSTRAINT "PlanPermission_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_role_id_fkey";

-- DropForeignKey
ALTER TABLE "SuperAdmin" DROP CONSTRAINT "SuperAdmin_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "SuperAdmin" DROP CONSTRAINT "SuperAdmin_role_id_fkey";

-- DropForeignKey
ALTER TABLE "SuperAdminRolePermission" DROP CONSTRAINT "SuperAdminRolePermission_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "SuperAdminRolePermission" DROP CONSTRAINT "SuperAdminRolePermission_role_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_consumer_id_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_role_id_fkey";

-- DropTable
DROP TABLE "BillingHistory";

-- DropTable
DROP TABLE "Consumer";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "Plan";

-- DropTable
DROP TABLE "PlanPermission";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "SuperAdmin";

-- DropTable
DROP TABLE "SuperAdminPermission";

-- DropTable
DROP TABLE "SuperAdminRole";

-- DropTable
DROP TABLE "SuperAdminRolePermission";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "super_admins" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" INTEGER,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "super_admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_permissions" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "super_admin_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_admin_role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "super_admin_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "consumers" (
    "id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "subdomain" TEXT NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_permissions" (
    "plan_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "plan_permissions_pkey" PRIMARY KEY ("plan_id","permission_id")
);

-- CreateTable
CREATE TABLE "billing_histories" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "billing_month" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "consumer_id" INTEGER NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "super_admins_email_idx" ON "super_admins"("email");

-- CreateIndex
CREATE INDEX "super_admins_name_idx" ON "super_admins"("name");

-- CreateIndex
CREATE INDEX "super_admins_role_id_idx" ON "super_admins"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_roles_name_key" ON "super_admin_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "super_admin_permissions_action_key" ON "super_admin_permissions"("action");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_subdomain_key" ON "consumers"("subdomain");

-- CreateIndex
CREATE INDEX "consumers_email_idx" ON "consumers"("email");

-- CreateIndex
CREATE INDEX "consumers_company_name_idx" ON "consumers"("company_name");

-- CreateIndex
CREATE INDEX "consumers_phone_idx" ON "consumers"("phone");

-- CreateIndex
CREATE INDEX "consumers_subdomain_idx" ON "consumers"("subdomain");

-- CreateIndex
CREATE INDEX "consumers_plan_id_idx" ON "consumers"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE INDEX "billing_histories_consumer_id_idx" ON "billing_histories"("consumer_id");

-- CreateIndex
CREATE INDEX "billing_histories_billing_month_idx" ON "billing_histories"("billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "billing_histories_consumer_id_billing_month_key" ON "billing_histories"("consumer_id", "billing_month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_consumer_id_idx" ON "users"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "roles_consumer_id_idx" ON "roles"("consumer_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_consumer_id_name_key" ON "roles"("consumer_id", "name");

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "super_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "super_admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_role_permissions" ADD CONSTRAINT "super_admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "super_admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "super_admin_role_permissions" ADD CONSTRAINT "super_admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "super_admin_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_permissions" ADD CONSTRAINT "plan_permissions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_permissions" ADD CONSTRAINT "plan_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_histories" ADD CONSTRAINT "billing_histories_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
