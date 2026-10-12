import type { Promotion } from "../types/promotion.types";
import type { ProductVariantForSale, SaleItem } from "../types/sale.types";
import { calculateTaxAndTotal } from "../utils/sale-item.utils";
export function variant(
  overrides: Partial<ProductVariantForSale> = {},
): ProductVariantForSale {
  return {
    id: 1,
    name: "Default",
    sku: "SKU1",
    barcode: "BAR1",
    product_name: "Product",
    unit_name: "Piece",
    regular_price: 100,
    wholesale_price: 80,
    tax_percentage: 0,
    tax_method: "EXCLUSIVE",
    ...overrides,
  };
}
export function item(overrides: Partial<SaleItem> = {}): SaleItem {
  const row: SaleItem = {
    variant_id: 1,
    variant_name: "Default",
    product_name: "Product",
    unit_name: "Piece",
    regular_price: 100,
    unit_price: 100,
    quantity: 1,
    tax_percentage: 0,
    tax_method: "EXCLUSIVE",
    average_discount_amount: 0,
    special_discount_amount: 0,
    promotion_discount_amount: 0,
    line_total: 0,
    ...overrides,
  };
  const totals = calculateTaxAndTotal(
    row.unit_price,
    row.quantity,
    row.tax_percentage ?? 0,
    row.tax_method ?? "EXCLUSIVE",
  );
  return {
    ...row,
    line_total: totals.line_total,
    tax_amount: totals.tax_amount,
  };
}
export function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 1,
    name: "Offer",
    scope: "SINGLE_PRODUCT",
    discount_type: "percentage",
    discount_value: 10,
    start_date: "2026-01-01T00:00:00Z",
    end_date: "2040-01-01T00:00:00Z",
    is_active: true,
    auto_apply: true,
    branch_specific: false,
    branch_ids: [],
    variant_ids: [1],
    sales_count: 0,
    total_discount_given: 0,
    total_discounted_sales: 0,
    ...overrides,
  };
}
