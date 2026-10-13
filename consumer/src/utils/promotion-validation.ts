import {
  Promotion,
  PromotionValidationResponse,
} from "../types/promotion.types";
import { SaleItem } from "../types/sale.types";

type AggregatedCartItem = {
  quantity: number;
  subtotal: number;
  unit_price: number;
};

type EvaluatePromotionLocallyInput = {
  promotion: Promotion;
  items: SaleItem[];
  branchId: number | null;
  customerId?: number;
  variantBrandById: Record<number, number | undefined>;
};

const toNumber = (value: unknown): number => Number(value ?? 0);

const getRequiredVariantIds = (promotion: Promotion): number[] => {
  const idsFromVariantField = promotion.variant_ids || [];
  if (idsFromVariantField.length > 0) {
    return Array.from(new Set(idsFromVariantField.map((id) => Number(id))));
  }

  const idsFromProducts = (promotion.products || []).map((item) =>
    Number(item.variant_id),
  );
  return Array.from(new Set(idsFromProducts));
};

const calculateEffectiveQuantity = (
  items: AggregatedCartItem[],
  quantityLimit: number | null,
): number => {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  if (quantityLimit === null) {
    return totalQuantity;
  }

  return Math.min(totalQuantity, quantityLimit);
};

const calculateBaseWithQuantityLimit = (
  items: AggregatedCartItem[],
  quantityLimit: number | null,
): number => {
  if (quantityLimit === null) {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  // Cart lines always have a positive quantity, so the per-unit price is well defined.
  const perUnitOf = (item: AggregatedCartItem) => item.subtotal / item.quantity;
  let remaining = quantityLimit;
  let base = 0;

  for (const item of [...items].sort((a, b) => perUnitOf(b) - perUnitOf(a))) {
    const takeQty = Math.min(item.quantity, remaining);
    base += perUnitOf(item) * takeQty;
    remaining -= takeQty;
  }

  return base;
};

const calculateDiscount = (
  discountType: Promotion["discount_type"],
  discountValue: number,
  base: number,
  eligibleQuantity: number,
  capDiscountAmount: number,
): number => {
  let discount = 0;

  if (discountType === "percentage") {
    discount = (base * discountValue) / 100;
  } else {
    discount = discountValue * eligibleQuantity;
  }

  if (capDiscountAmount > 0) {
    discount = Math.min(discount, capDiscountAmount);
  }

  // A non-positive base or quantity never yields a discount.
  return Math.max(0, Math.min(base, discount));
};

const ineligible = (
  promotionId: number,
  reason: string,
): PromotionValidationResponse => ({
  promotion_id: promotionId,
  is_eligible: false,
  reason,
});

export const evaluatePromotionLocally = ({
  promotion,
  items,
  branchId,
  customerId,
  variantBrandById,
}: EvaluatePromotionLocallyInput): PromotionValidationResponse => {
  if (!branchId) {
    return ineligible(
      promotion.id,
      "Please select a branch before applying a promotion",
    );
  }

  if (!promotion.is_active) {
    return ineligible(promotion.id, "Promotion is inactive");
  }

  const now = new Date();
  const startDate = new Date(promotion.start_date);
  if (!Number.isNaN(startDate.getTime()) && startDate > now) {
    return ineligible(promotion.id, "Promotion has not started yet");
  }

  if (promotion.end_date) {
    const endDate = new Date(promotion.end_date);
    if (!Number.isNaN(endDate.getTime()) && endDate < now) {
      return ineligible(promotion.id, "Promotion has already expired");
    }
  }

  if (
    promotion.branch_specific &&
    (!promotion.branch_ids?.length || !promotion.branch_ids.includes(branchId))
  ) {
    return ineligible(
      promotion.id,
      "Promotion is not available for selected branch",
    );
  }

  const usageLimit = toNumber(promotion.usage_limit);
  const maxDiscountAmount =
    promotion.max_discount_amount !== null &&
    promotion.max_discount_amount !== undefined
      ? toNumber(promotion.max_discount_amount)
      : null;

  const usedUsageCount = toNumber(promotion.sales_count);
  const usedDiscountAmount = toNumber(promotion.total_discount_given);

  if (usageLimit > 0 && usedUsageCount >= usageLimit) {
    return ineligible(
      promotion.id,
      "Promotion usage limit reached and promo closed",
    );
  }

  if (
    maxDiscountAmount !== null &&
    maxDiscountAmount > 0 &&
    usedDiscountAmount >= maxDiscountAmount
  ) {
    return ineligible(
      promotion.id,
      "Promotion max discount reached and promo closed",
    );
  }

  if (promotion.member_only && !customerId) {
    return ineligible(
      promotion.id,
      "This promotion is for registered customers only",
    );
  }

  if (promotion.limit_per_customer && !customerId) {
    return ineligible(
      promotion.id,
      "Select a registered customer to apply this promotion",
    );
  }

  const cartMap = new Map<number, AggregatedCartItem>();

  for (const item of items) {
    const quantity = toNumber(item.quantity);
    if (quantity <= 0) {
      continue;
    }

    const existing = cartMap.get(item.variant_id);
    // Promotions are calculated on product base price regardless of tax method.
    const subtotal =
      toNumber(item.unit_price) * quantity || toNumber(item.line_total);

    if (existing) {
      cartMap.set(item.variant_id, {
        quantity: existing.quantity + quantity,
        subtotal: existing.subtotal + subtotal,
        unit_price: toNumber(item.unit_price),
      });
      continue;
    }

    cartMap.set(item.variant_id, {
      quantity,
      subtotal,
      unit_price: toNumber(item.unit_price),
    });
  }

  if (cartMap.size === 0) {
    return ineligible(promotion.id, "Cart is empty");
  }

  const cartSubtotal = Array.from(cartMap.values()).reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const minPurchase = toNumber(promotion.min_purchase);

  if (minPurchase > 0 && cartSubtotal < minPurchase) {
    return ineligible(
      promotion.id,
      "Minimum purchase amount condition not met",
    );
  }

  const minQuantity = Math.max(1, toNumber(promotion.min_quantity || 1));

  let matchedVariantIds: number[] = [];

  if (promotion.scope === "BRAND") {
    const brandId = toNumber(promotion.brand_id);

    if (!brandId) {
      return ineligible(
        promotion.id,
        "Promotion brand is not configured correctly",
      );
    }

    matchedVariantIds = Array.from(cartMap.keys()).filter(
      (variantId) => Number(variantBrandById[variantId]) === brandId,
    );

    if (!matchedVariantIds.length) {
      return ineligible(
        promotion.id,
        "No matching brand products found in cart",
      );
    }
  } else if (promotion.scope === "SINGLE_PRODUCT") {
    const requiredVariantIds = getRequiredVariantIds(promotion);
    const selectedVariantId = requiredVariantIds[0];

    if (!selectedVariantId) {
      return ineligible(promotion.id, "Promotion has no products configured");
    }

    if (!cartMap.has(selectedVariantId)) {
      return ineligible(
        promotion.id,
        "Required product is not present in cart",
      );
    }

    matchedVariantIds = [selectedVariantId];
  } else {
    const requiredVariantIds = getRequiredVariantIds(promotion);

    if (!requiredVariantIds.length) {
      return ineligible(promotion.id, "Promotion has no products configured");
    }

    const missingVariant = requiredVariantIds.find(
      (variantId) => !cartMap.has(variantId),
    );

    if (missingVariant) {
      return ineligible(
        promotion.id,
        "Bundle conditions are not matched in cart",
      );
    }

    matchedVariantIds = requiredVariantIds;
  }

  const totalMatchedQuantity = matchedVariantIds.reduce(
    (sum, variantId) => sum + (cartMap.get(variantId)?.quantity || 0),
    0,
  );

  if (totalMatchedQuantity < minQuantity) {
    return ineligible(promotion.id, `Minimum quantity ${minQuantity} not met`);
  }

  const matchedItems = matchedVariantIds
    .map((variantId) => cartMap.get(variantId))
    .filter((item): item is AggregatedCartItem => Boolean(item));

  const quantityLimit = toNumber(promotion.cap_quantity);
  const effectiveQuantityLimit = quantityLimit > 0 ? quantityLimit : null;

  const discountBase = calculateBaseWithQuantityLimit(
    matchedItems,
    effectiveQuantityLimit,
  );
  const eligibleQuantity = calculateEffectiveQuantity(
    matchedItems,
    effectiveQuantityLimit,
  );

  const capDiscountAmount = toNumber(promotion.cap_discount_amount);

  const computedDiscount = calculateDiscount(
    promotion.discount_type,
    toNumber(promotion.discount_value),
    discountBase,
    eligibleQuantity,
    capDiscountAmount,
  );

  const remainingDiscountLimit =
    maxDiscountAmount !== null
      ? Math.max(0, maxDiscountAmount - usedDiscountAmount)
      : null;

  const finalDiscount =
    remainingDiscountLimit !== null
      ? Math.min(computedDiscount, remainingDiscountLimit)
      : computedDiscount;

  if (finalDiscount <= 0) {
    return ineligible(
      promotion.id,
      "Promotion max discount reached and promo closed",
    );
  }

  return {
    promotion_id: promotion.id,
    is_eligible: true,
    discount_amount: Number(finalDiscount.toFixed(2)),
    discount_base: Number(discountBase.toFixed(2)),
    matched_variant_ids: matchedVariantIds,
  };
};
