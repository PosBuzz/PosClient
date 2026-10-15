import { BadRequestException } from '@nestjs/common';

const roundMoney = (value: number) => Number((Number(value) || 0).toFixed(2));

// Rounding of independently rounded parts (line total vs. its discounts) can
// differ by a cent per component; anything beyond this is a different price.
const MONEY_TOLERANCE = 0.02;

/**
 * MIRROR of consumer/src/utils/sale-item.utils.ts#calculateTaxAndTotal.
 * The POS computes line totals with that function and the server re-derives
 * them here to reject tampered prices; the two must stay identical.
 */
export function calculateTaxAndTotal(
  price: number,
  quantity: number,
  taxPercentage: number,
  taxMethod: string,
) {
  const baseAmount = quantity * price;
  const validTaxPercentage = Number(taxPercentage) || 0;
  const isInclusiveTax = String(taxMethod || 'EXCLUSIVE')
    .trim()
    .toUpperCase()
    .startsWith('INC');

  let taxAmount: number;
  let lineTotal: number;
  if (isInclusiveTax) {
    lineTotal = baseAmount;
    taxAmount =
      validTaxPercentage > 0
        ? (baseAmount * validTaxPercentage) / (100 + validTaxPercentage)
        : 0;
  } else {
    taxAmount = (baseAmount * validTaxPercentage) / 100;
    lineTotal = baseAmount + taxAmount;
  }

  return {
    line_total: roundMoney(lineTotal),
    tax_amount: roundMoney(taxAmount),
  };
}

/** Price the POS charges for a variant: wholesale falls back to regular. */
export function catalogUnitPrice(
  variant: { regular_price: unknown; wholesale_price: unknown },
  isWholesale: boolean,
): number {
  return isWholesale
    ? Number(variant.wholesale_price) || Number(variant.regular_price)
    : Number(variant.regular_price);
}

/**
 * Rejects a sale line whose price, tax or discounts do not match the catalog.
 * The client sends discounted `line_total`; adding its discounts back must give
 * the catalog line total.
 */
export function assertSaleLineMatchesCatalog(
  item: {
    variant_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
    tax_amount?: number;
    average_discount_amount?: number;
    special_discount_amount?: number;
    promotion_discount_amount?: number;
  },
  variant: {
    regular_price: unknown;
    wholesale_price: unknown;
    product: { tax: number; tax_method: string };
  },
  isWholesale: boolean,
): void {
  const expectedPrice = catalogUnitPrice(variant, isWholesale);
  if (Math.abs(Number(item.unit_price) - expectedPrice) > 0.005) {
    throw new BadRequestException(
      `Price of variant ${item.variant_id} has changed (now ${expectedPrice.toFixed(2)}). Refresh the product list and try again.`,
    );
  }

  const expected = calculateTaxAndTotal(
    expectedPrice,
    Number(item.quantity),
    variant.product.tax,
    variant.product.tax_method,
  );
  const discounts =
    (Number(item.average_discount_amount) || 0) +
    (Number(item.special_discount_amount) || 0) +
    (Number(item.promotion_discount_amount) || 0);

  if (
    Math.abs((Number(item.tax_amount) || 0) - expected.tax_amount) >
      MONEY_TOLERANCE ||
    Math.abs(Number(item.line_total) + discounts - expected.line_total) >
      MONEY_TOLERANCE
  ) {
    throw new BadRequestException(
      `Line total or tax for variant ${item.variant_id} does not match its catalog price and tax. Refresh the product list and try again.`,
    );
  }

  if (discounts > expected.line_total + MONEY_TOLERANCE) {
    throw new BadRequestException(
      `Discounts on variant ${item.variant_id} exceed its line total`,
    );
  }
}
