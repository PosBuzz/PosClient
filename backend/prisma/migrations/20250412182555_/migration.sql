/*
  Warnings:

  - Added the required column `email` to the `Consumer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Consumer" ADD COLUMN     "email" TEXT NOT NULL;
