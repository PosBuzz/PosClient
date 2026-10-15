import type { SaleItem } from "../types/sale.types";

/**
 * Item payload sent to the backend for a sale or quotation. Shared by the POS,
 * add-sale and add-quotation pages and by the X1 round-trip contract, so the
 * shape the backend validates is defined in exactly one place.
 */
export const toSalePayloadItems = (discountedItems: SaleItem[]) =>
  discountedItems.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    sold_unit_price: item.sold_unit_price,
    average_discount_amount: item.average_discount_amount,
    special_discount_amount: item.special_discount_amount,
    promotion_discount_amount: item.promotion_discount_amount,
    applied_promotion_id: item.applied_promotion_id,
    tax_amount: item.tax_amount,
    line_total: item.line_total,
  }));
