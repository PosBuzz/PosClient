import { Promotion, PromotionValidationResponse } from "../types/promotion.types";
import {
  DiscountType,
  SaleItem,
} from "../types/sale.types";

const round2 = (value: number) => Number((value || 0).toFixed(2));

const getItemBaseAmount = (item: SaleItem) => {
  const taxMethod = String(item.tax_method || "EXCLUSIVE").toUpperCase();
  if (taxMethod === "INCLUSIVE") {
    return Math.max(0, Number(item.line_total) - Number(item.tax_amount || 0));
  }
  return Number(item.unit_price) * Number(item.quantity);
};

function distributeDiscount(
  totalDiscount: number,
  selectedItems: SaleItem[],
  baseMap?: Map<number, number>,
): Map<number, number> {
  const distributed = new Map<number, number>();
  selectedItems.forEach((item) => distributed.set(item.variant_id, 0));

  const targetItems = selectedItems.filter(
    (item) => (baseMap?.get(item.variant_id) || 0) > 0,
  );
  const totalBase = targetItems.reduce(
    (sum, item) => sum + (baseMap?.get(item.variant_id) || 0),
    0,
  );

  if (totalDiscount <= 0 || targetItems.length === 0 || totalBase <= 0) {
    return distributed;
  }

  let assigned = 0;
  targetItems.forEach((item, index) => {
    const isLast = index === targetItems.length - 1;
    if (isLast) {
      distributed.set(item.variant_id, round2(totalDiscount - assigned));
      return;
    }

    const base = baseMap?.get(item.variant_id) || 0;
    const share = round2((totalDiscount * base) / totalBase);
    distributed.set(item.variant_id, share);
    assigned += share;
  });

  return distributed;
}

export interface DiscountBreakdown {
  average: number;
  special: number;
  promotion: number;
  total: number;
  appliedPromotionId?: number;
  appliedPromotionName?: string;
  appliedPromotionMatchedQuantity?: number;
  promotionId?: number;
  promotionName?: string;
}

export interface SaleTotals {
  subtotal: number;
  totalTax: number;
  promotionDiscount: number;
  averageDiscount: number;
  specialDiscount: number;
  finalDiscount: number;
  discountBreakdownByVariant: Record<number, DiscountBreakdown>;
  discountedItems: SaleItem[];
  shippingCost: number;
  total: number;
}

export function calculateSaleTotals(params: {
  selectedItems: SaleItem[];
  averageDiscountAmount: number;
  averageDiscountType: DiscountType;
  shippingCost: number;
  appliedPromotions: Promotion[];
  evaluatePromotionFn: (
    promotion: Promotion,
    items: SaleItem[],
  ) => PromotionValidationResponse;
}): SaleTotals {
  const {
    selectedItems,
    averageDiscountAmount,
    averageDiscountType,
    shippingCost,
    appliedPromotions,
    evaluatePromotionFn,
  } = params;

  const subtotal = selectedItems.reduce(
    (sum, item) => sum + getItemBaseAmount(item),
    0,
  );

  const averageDiscountBaseSubtotal = selectedItems.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 0),
    0,
  );

  const totalTax = selectedItems.reduce(
    (sum, item) => sum + (Number(item.tax_amount) || 0),
    0,
  );

  const averageDiscountAmountNum = Number(averageDiscountAmount) || 0;
  const shippingCostNum = Number(shippingCost) || 0;

  const averageDiscount =
    averageDiscountType === DiscountType.PERCENTAGE
      ? (averageDiscountBaseSubtotal * averageDiscountAmountNum) / 100
      : averageDiscountAmountNum;

  const specialDiscount = selectedItems.reduce(
    (sum, item) => sum + (Number(item.special_discount_amount) || 0),
    0,
  );

  const variantBaseMap = new Map<number, number>();
  const variantQuantityMap = new Map<number, number>();
  selectedItems.forEach((item) => {
    const rawBase = Number(item.unit_price) * Number(item.quantity || 0);
    variantBaseMap.set(item.variant_id, Number(rawBase) || 0);
    variantQuantityMap.set(item.variant_id, Number(item.quantity || 0));
  });

  const averageDiscountMap = distributeDiscount(
    Number(averageDiscount) || 0,
    selectedItems,
    variantBaseMap,
  );

  // Per-variant best promotion selection (5-tier conflict resolution)
  const promotionChoiceByVariant = new Map<
    number,
    {
      promotionId: number;
      discount: number;
      matchedVariantCount: number;
      matchedTotalQty: number;
      matchedItemQty: number;
    }
  >();

  for (const promotion of appliedPromotions) {
    const validation = evaluatePromotionFn(promotion, selectedItems);
    if (!validation.is_eligible) continue;

    const promotionDiscount = Number(validation.discount_amount || 0);
    const matchedVariantIds = new Set(validation.matched_variant_ids || []);
    const matchedVariantCount = matchedVariantIds.size;
    const matchedTotalQty = selectedItems.reduce(
      (sum, item) =>
        matchedVariantIds.has(item.variant_id)
          ? sum + Number(item.quantity || 0)
          : sum,
      0,
    );

    const eligibleBaseMap = new Map<number, number>();
    selectedItems.forEach((item) => {
      if (!matchedVariantIds.has(item.variant_id)) return;
      const base = Number(variantBaseMap.get(item.variant_id) || 0);
      if (base > 0) {
        eligibleBaseMap.set(item.variant_id, base);
      }
    });

    const promoDistMap = distributeDiscount(
      promotionDiscount,
      selectedItems,
      eligibleBaseMap,
    );

    selectedItems.forEach((item) => {
      if (!matchedVariantIds.has(item.variant_id)) return;

      const itemDiscount = promoDistMap.get(item.variant_id) || 0;
      if (itemDiscount <= 0) return;

      const matchedItemQty = Number(item.quantity || 0);
      const current = promotionChoiceByVariant.get(item.variant_id);

      if (!current) {
        promotionChoiceByVariant.set(item.variant_id, {
          promotionId: promotion.id,
          discount: itemDiscount,
          matchedVariantCount,
          matchedTotalQty,
          matchedItemQty,
        });
      } else if (
        itemDiscount > current.discount ||
        (itemDiscount === current.discount &&
          (matchedVariantCount > current.matchedVariantCount ||
            (matchedVariantCount === current.matchedVariantCount &&
              (matchedTotalQty > current.matchedTotalQty ||
                (matchedTotalQty === current.matchedTotalQty &&
                  (matchedItemQty > current.matchedItemQty ||
                    (matchedItemQty === current.matchedItemQty &&
                      promotion.id < current.promotionId)))))))
      ) {
        promotionChoiceByVariant.set(item.variant_id, {
          promotionId: promotion.id,
          discount: itemDiscount,
          matchedVariantCount,
          matchedTotalQty,
          matchedItemQty,
        });
      }
    });
  }

  const promotionDiscountMap = new Map<number, number>();
  promotionChoiceByVariant.forEach((choice, variantId) => {
    promotionDiscountMap.set(variantId, choice.discount);
  });

  const promotionDiscountAmount = Array.from(promotionDiscountMap.values()).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  const finalDiscount =
    promotionDiscountAmount + averageDiscount + specialDiscount;

  const total = subtotal - finalDiscount + totalTax + shippingCostNum;

  const discountBreakdownByVariant: Record<number, DiscountBreakdown> = {};

  const discountedItems = selectedItems.map((item) => {
    const averageShare = Number(averageDiscountMap.get(item.variant_id) || 0);
    const promotionShare = Number(
      promotionDiscountMap.get(item.variant_id) || 0,
    );
    const specialShare = Number(item.special_discount_amount || 0);

    const choice = promotionChoiceByVariant.get(item.variant_id);

    const appliedPromotion = choice
      ? appliedPromotions.find((p) => p.id === choice.promotionId)
      : undefined;

    discountBreakdownByVariant[item.variant_id] = {
      average: round2(averageShare),
      special: round2(specialShare),
      promotion: round2(promotionShare),
      total: round2(averageShare + specialShare + promotionShare),
      appliedPromotionId: choice?.promotionId,
      appliedPromotionName: appliedPromotion?.name,
      appliedPromotionMatchedQuantity: choice?.matchedTotalQty,
      promotionId: choice?.promotionId,
      promotionName: appliedPromotion?.name,
    };

    const totalItemDiscount = averageShare + specialShare + promotionShare;
    const netLineTotal = round2(Number(item.line_total) - totalItemDiscount);
    const soldUnitPrice = round2(netLineTotal / Number(item.quantity || 1));

    return {
      ...item,
      unit_price: item.unit_price,
      sold_unit_price: soldUnitPrice,
      line_total: netLineTotal,
      average_discount_amount: round2(averageShare),
      special_discount_amount: round2(specialShare),
      promotion_discount_amount: round2(promotionShare),
      applied_promotion_id: choice?.promotionId,
    };
  });

  return {
    subtotal: Number(subtotal),
    totalTax: Number(totalTax),
    promotionDiscount: Number(promotionDiscountAmount),
    averageDiscount: Number(averageDiscount),
    specialDiscount: Number(specialDiscount),
    finalDiscount: Number(finalDiscount),
    discountBreakdownByVariant,
    discountedItems,
    shippingCost: Number(shippingCostNum),
    total: Number(total),
  };
}
