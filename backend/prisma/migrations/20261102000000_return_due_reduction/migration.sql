-- A return on a sale that still has a due first cancels that due instead of paying money out
ALTER TABLE "returns" ADD COLUMN "due_reduction" DECIMAL(10,2) NOT NULL DEFAULT 0;
