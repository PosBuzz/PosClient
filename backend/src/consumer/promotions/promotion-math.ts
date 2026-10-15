import { PromotionDiscountType } from './dto/create-promotion.dto';

export function calculateDiscount(
  discountType: string,
  discountValue: number,
  base: number,
  eligibleQuantity: number,
  capDiscountAmount?: number | null,
) {
  if (base <= 0 || eligibleQuantity <= 0) return 0;

  let discount = 0;

  if (discountType === PromotionDiscountType.PERCENTAGE) {
    discount = (base * discountValue) / 100;
  } else {
    // Fixed amount promotions are applied per eligible unit.
    discount = discountValue * eligibleQuantity;
  }

  if (
    capDiscountAmount !== null &&
    capDiscountAmount !== undefined &&
    capDiscountAmount > 0
  ) {
    discount = Math.min(discount, capDiscountAmount);
  }

  return Math.min(base, discount);
}

export function calculateEffectiveQuantity(
  items: Array<{ quantity: number; subtotal: number }>,
  quantityLimit?: number | null,
) {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!quantityLimit || quantityLimit <= 0) {
    return totalQuantity;
  }

  return Math.min(totalQuantity, quantityLimit);
}

export function calculateBaseWithQuantityLimit(
  items: Array<{ quantity: number; subtotal: number }>,
  quantityLimit?: number | null,
) {
  const totalBase = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (!quantityLimit || quantityLimit <= 0) {
    return totalBase;
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity <= quantityLimit) {
    return totalBase;
  }

  let remaining = quantityLimit;
  let base = 0;

  const sorted = [...items].sort((a, b) => {
    const aPerUnit = a.quantity > 0 ? a.subtotal / a.quantity : 0;
    const bPerUnit = b.quantity > 0 ? b.subtotal / b.quantity : 0;
    return bPerUnit - aPerUnit;
  });

  for (const item of sorted) {
    if (remaining <= 0) {
      break;
    }

    const takeQty = Math.min(item.quantity, remaining);
    const perUnit = item.quantity > 0 ? item.subtotal / item.quantity : 0;
    base += perUnit * takeQty;
    remaining -= takeQty;
  }

  return base;
}
