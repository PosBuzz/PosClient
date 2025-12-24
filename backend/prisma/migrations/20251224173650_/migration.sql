/*
  Warnings:

  - A unique constraint covering the columns `[employee_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[consumer_id,email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('PENDING', 'APPLIED', 'PARTIALLY_APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'DEDUCTED', 'PARTIALLY_DEDUCTED');

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "hierarchy_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reports_to_role_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cv_url" TEXT,
ADD COLUMN     "date_of_birth" TIMESTAMP(3),
ADD COLUMN     "date_of_joining" TIMESTAMP(3),
ADD COLUMN     "employee_id" TEXT,
ADD COLUMN     "employment_status" "EmploymentStatus" DEFAULT 'ACTIVE',
ADD COLUMN     "nid_document_url" TEXT,
ADD COLUMN     "nid_number" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photo_url" TEXT;

-- CreateTable
CREATE TABLE "erp_settings" (
    "id" SERIAL NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "attendance_gps_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gps_radius_meters" INTEGER DEFAULT 100,
    "salary_cycle" TEXT NOT NULL DEFAULT 'monthly',
    "salary_payment_day" INTEGER DEFAULT 1,
    "overtime_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "basic_salary" DECIMAL(10,2) NOT NULL,
    "house_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "medical_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transport_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "food_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_allowances" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtime_hourly_rate" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_increments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "previous_basic" DECIMAL(10,2) NOT NULL,
    "new_basic" DECIMAL(10,2) NOT NULL,
    "increment_amount" DECIMAL(10,2) NOT NULL,
    "increment_percentage" DECIMAL(5,2),
    "reason" TEXT,
    "notes" TEXT,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_increments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "check_in_time" TIMESTAMP(3),
    "check_out_time" TIMESTAMP(3),
    "check_in_latitude" DECIMAL(10,8),
    "check_in_longitude" DECIMAL(11,8),
    "check_out_latitude" DECIMAL(10,8),
    "check_out_longitude" DECIMAL(11,8),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "worked_hours" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "leave_type" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "total_days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtimes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "hourly_rate" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overtimes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "receipt_url" TEXT,
    "include_in_salary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deductions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" "DeductionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advances" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "request_date" DATE NOT NULL,
    "reason" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "paid_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "consumer_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "calculation_details" JSONB,
    "basic_salary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "house_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "medical_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "transport_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "food_allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_allowances" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "overtime_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reimbursable_expenses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gross_salary" DECIMAL(10,2) NOT NULL,
    "total_deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_salary" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_method" "PaymentMethodEnum" NOT NULL,
    "payment_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_payments" (
    "id" SERIAL NOT NULL,
    "salary_payment_id" INTEGER NOT NULL,
    "expense_id" INTEGER NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deduction_payments" (
    "id" SERIAL NOT NULL,
    "salary_payment_id" INTEGER NOT NULL,
    "deduction_id" INTEGER NOT NULL,
    "amount_deducted" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deduction_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payments" (
    "id" SERIAL NOT NULL,
    "salary_payment_id" INTEGER NOT NULL,
    "advance_id" INTEGER NOT NULL,
    "amount_deducted" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_payments" (
    "id" SERIAL NOT NULL,
    "salary_payment_id" INTEGER NOT NULL,
    "overtime_id" INTEGER NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_settings_consumer_id_key" ON "erp_settings"("consumer_id");

-- CreateIndex
CREATE INDEX "salary_structures_user_id_idx" ON "salary_structures"("user_id");

-- CreateIndex
CREATE INDEX "salary_structures_consumer_id_idx" ON "salary_structures"("consumer_id");

-- CreateIndex
CREATE INDEX "salary_structures_is_active_idx" ON "salary_structures"("is_active");

-- CreateIndex
CREATE INDEX "salary_structures_effective_from_idx" ON "salary_structures"("effective_from");

-- CreateIndex
CREATE INDEX "salary_increments_user_id_idx" ON "salary_increments"("user_id");

-- CreateIndex
CREATE INDEX "salary_increments_consumer_id_idx" ON "salary_increments"("consumer_id");

-- CreateIndex
CREATE INDEX "salary_increments_effective_date_idx" ON "salary_increments"("effective_date");

-- CreateIndex
CREATE INDEX "salary_increments_created_by_user_id_idx" ON "salary_increments"("created_by_user_id");

-- CreateIndex
CREATE INDEX "attendances_consumer_id_idx" ON "attendances"("consumer_id");

-- CreateIndex
CREATE INDEX "attendances_date_idx" ON "attendances"("date");

-- CreateIndex
CREATE INDEX "attendances_status_idx" ON "attendances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_user_id_date_key" ON "attendances"("user_id", "date");

-- CreateIndex
CREATE INDEX "leaves_user_id_idx" ON "leaves"("user_id");

-- CreateIndex
CREATE INDEX "leaves_consumer_id_idx" ON "leaves"("consumer_id");

-- CreateIndex
CREATE INDEX "leaves_leave_type_idx" ON "leaves"("leave_type");

-- CreateIndex
CREATE INDEX "leaves_status_idx" ON "leaves"("status");

-- CreateIndex
CREATE INDEX "leaves_start_date_idx" ON "leaves"("start_date");

-- CreateIndex
CREATE INDEX "leaves_approved_by_user_id_idx" ON "leaves"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "overtimes_user_id_idx" ON "overtimes"("user_id");

-- CreateIndex
CREATE INDEX "overtimes_consumer_id_idx" ON "overtimes"("consumer_id");

-- CreateIndex
CREATE INDEX "overtimes_date_idx" ON "overtimes"("date");

-- CreateIndex
CREATE INDEX "overtimes_status_idx" ON "overtimes"("status");

-- CreateIndex
CREATE INDEX "overtimes_approved_by_user_id_idx" ON "overtimes"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "expenses_user_id_idx" ON "expenses"("user_id");

-- CreateIndex
CREATE INDEX "expenses_consumer_id_idx" ON "expenses"("consumer_id");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_include_in_salary_idx" ON "expenses"("include_in_salary");

-- CreateIndex
CREATE INDEX "expenses_approved_by_user_id_idx" ON "expenses"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "deductions_user_id_idx" ON "deductions"("user_id");

-- CreateIndex
CREATE INDEX "deductions_consumer_id_idx" ON "deductions"("consumer_id");

-- CreateIndex
CREATE INDEX "deductions_type_idx" ON "deductions"("type");

-- CreateIndex
CREATE INDEX "deductions_status_idx" ON "deductions"("status");

-- CreateIndex
CREATE INDEX "deductions_date_idx" ON "deductions"("date");

-- CreateIndex
CREATE INDEX "advances_user_id_idx" ON "advances"("user_id");

-- CreateIndex
CREATE INDEX "advances_consumer_id_idx" ON "advances"("consumer_id");

-- CreateIndex
CREATE INDEX "advances_status_idx" ON "advances"("status");

-- CreateIndex
CREATE INDEX "advances_request_date_idx" ON "advances"("request_date");

-- CreateIndex
CREATE INDEX "advances_approved_by_user_id_idx" ON "advances"("approved_by_user_id");

-- CreateIndex
CREATE INDEX "salary_payments_user_id_idx" ON "salary_payments"("user_id");

-- CreateIndex
CREATE INDEX "salary_payments_consumer_id_idx" ON "salary_payments"("consumer_id");

-- CreateIndex
CREATE INDEX "salary_payments_period_start_idx" ON "salary_payments"("period_start");

-- CreateIndex
CREATE INDEX "salary_payments_period_end_idx" ON "salary_payments"("period_end");

-- CreateIndex
CREATE INDEX "salary_payments_payment_date_idx" ON "salary_payments"("payment_date");

-- CreateIndex
CREATE INDEX "expense_payments_expense_id_idx" ON "expense_payments"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_payments_salary_payment_id_expense_id_key" ON "expense_payments"("salary_payment_id", "expense_id");

-- CreateIndex
CREATE INDEX "deduction_payments_deduction_id_idx" ON "deduction_payments"("deduction_id");

-- CreateIndex
CREATE UNIQUE INDEX "deduction_payments_salary_payment_id_deduction_id_key" ON "deduction_payments"("salary_payment_id", "deduction_id");

-- CreateIndex
CREATE INDEX "advance_payments_advance_id_idx" ON "advance_payments"("advance_id");

-- CreateIndex
CREATE UNIQUE INDEX "advance_payments_salary_payment_id_advance_id_key" ON "advance_payments"("salary_payment_id", "advance_id");

-- CreateIndex
CREATE INDEX "overtime_payments_overtime_id_idx" ON "overtime_payments"("overtime_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_payments_salary_payment_id_overtime_id_key" ON "overtime_payments"("salary_payment_id", "overtime_id");

-- CreateIndex
CREATE INDEX "roles_hierarchy_level_idx" ON "roles"("hierarchy_level");

-- CreateIndex
CREATE INDEX "roles_reports_to_role_id_idx" ON "roles"("reports_to_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_employee_id_idx" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_employment_status_idx" ON "users"("employment_status");

-- CreateIndex
CREATE UNIQUE INDEX "users_consumer_id_email_key" ON "users"("consumer_id", "email");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_reports_to_role_id_fkey" FOREIGN KEY ("reports_to_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_settings" ADD CONSTRAINT "erp_settings_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_increments" ADD CONSTRAINT "salary_increments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_increments" ADD CONSTRAINT "salary_increments_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_increments" ADD CONSTRAINT "salary_increments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtimes" ADD CONSTRAINT "overtimes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtimes" ADD CONSTRAINT "overtimes_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtimes" ADD CONSTRAINT "overtimes_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "consumers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_salary_payment_id_fkey" FOREIGN KEY ("salary_payment_id") REFERENCES "salary_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_payments" ADD CONSTRAINT "expense_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deduction_payments" ADD CONSTRAINT "deduction_payments_salary_payment_id_fkey" FOREIGN KEY ("salary_payment_id") REFERENCES "salary_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deduction_payments" ADD CONSTRAINT "deduction_payments_deduction_id_fkey" FOREIGN KEY ("deduction_id") REFERENCES "deductions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_salary_payment_id_fkey" FOREIGN KEY ("salary_payment_id") REFERENCES "salary_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_payments" ADD CONSTRAINT "overtime_payments_salary_payment_id_fkey" FOREIGN KEY ("salary_payment_id") REFERENCES "salary_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_payments" ADD CONSTRAINT "overtime_payments_overtime_id_fkey" FOREIGN KEY ("overtime_id") REFERENCES "overtimes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
