import {
  Promotion,
  PromotionValidationResponse,
} from "../types/promotion.types";
import { DiscountType, SaleItem } from "../types/sale.types";

const round2 = (value: number) => Number((value || 0).toFixed(2));

// Reconstruct the same rounded base as sales.service.ts#create. Independently
// rounded tax/gross can differ from raw price × qty by a cent.
const getItemBaseAmount = (item: SaleItem) =>
  Math.max(0, Number(item.line_total) - Number(item.tax_amount || 0));

function distributeDiscount(
  totalDiscount: number,
  selectedItems: SaleItem[],
  baseMap: Map<number, number>,
  capacityMap: Map<number, number>,
): Map<number, number> {
  const distributed = new Map<number, number>();
  selectedItems.forEach((item) => distributed.set(item.variant_id, 0));
  const capacities = new Map(
    selectedItems.map((item) => [
      item.variant_id,
      Math.max(0, Math.round(capacityMap.get(item.variant_id)! * 100)),
    ]),
  );
  const targets = selectedItems.filter(
    (item) => (baseMap.get(item.variant_id) || 0) > 0,
  );
  let remaining = Math.min(
    Math.max(0, Math.round(totalDiscount * 100)),
    targets.reduce((sum, item) => sum + capacities.get(item.variant_id)!, 0),
  );
  // Work in integer cents: never assign a negative rounding remainder. When
  // one line reaches its capacity, distribute the rest among available lines.
  while (remaining > 0) {
    const eligible = targets.filter(
      (item) => capacities.get(item.variant_id)! > 0,
    );
    const budget = remaining;
    const totalBase = eligible.reduce(
      (sum, item) => sum + baseMap.get(item.variant_id)!,
      0,
    );
    eligible.forEach((item, index) => {
      const wanted =
        index === eligible.length - 1
          ? remaining
          : Math.round((budget * baseMap.get(item.variant_id)!) / totalBase);
      const share = Math.min(
        wanted,
        remaining,
        capacities.get(item.variant_id)!,
      );
      distributed.set(
        item.variant_id,
        distributed.get(item.variant_id)! + share,
      );
      capacities.set(item.variant_id, capacities.get(item.variant_id)! - share);
      remaining -= share;
    });
  }
  distributed.forEach((cents, id) => distributed.set(id, cents / 100));
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

  const subtotal = round2(
    selectedItems.reduce((sum, item) => sum + getItemBaseAmount(item), 0),
  );

  const averageDiscountBaseSubtotal = round2(
    selectedItems.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity || 0),
      0,
    ),
  );

  const totalTax = round2(
    selectedItems.reduce(
      (sum, item) => sum + (Number(item.tax_amount) || 0),
      0,
    ),
  );

  const averageDiscountAmountNum = Number(averageDiscountAmount) || 0;
  const shippingCostNum = Number(shippingCost) || 0;

  const requestedAverageDiscount = Math.max(
    0,
    round2(
      averageDiscountType === DiscountType.PERCENTAGE
        ? (averageDiscountBaseSubtotal * averageDiscountAmountNum) / 100
        : averageDiscountAmountNum,
    ),
  );
  const lineCapacityMap = new Map(
    selectedItems.map((item) => [
      item.variant_id,
      Math.max(0, round2(Number(item.line_total))),
    ]),
  );

  const variantBaseMap = new Map<number, number>();
  const variantQuantityMap = new Map<number, number>();
  selectedItems.forEach((item) => {
    const rawBase = Number(item.unit_price) * Number(item.quantity || 0);
    variantBaseMap.set(item.variant_id, Number(rawBase) || 0);
    variantQuantityMap.set(item.variant_id, Number(item.quantity || 0));
  });

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
      lineCapacityMap,
    );

    selectedItems.forEach((item) => {
      if (!matchedVariantIds.has(item.variant_id)) return;

      const itemDiscount = promoDistMap.get(item.variant_id) || 0;
      if (itemDiscount <= 0) return;

      const matchedItemQty = Number(item.quantity);
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

  // Apply confirmed promotion choices first, then each requested special
  // discount, then the average discount within the remaining line capacities.
  const specialDiscountMap = new Map<number, number>();
  const averageCapacityMap = new Map<number, number>();
  selectedItems.forEach((item) => {
    const remaining = Math.max(
      0,
      round2(
        lineCapacityMap.get(item.variant_id)! -
          (promotionDiscountMap.get(item.variant_id) || 0),
      ),
    );
    const special = Math.min(
      remaining,
      Math.max(0, round2(Number(item.special_discount_amount) || 0)),
    );
    specialDiscountMap.set(item.variant_id, special);
    averageCapacityMap.set(item.variant_id, round2(remaining - special));
  });
  const averageDiscountMap = distributeDiscount(
    requestedAverageDiscount,
    selectedItems,
    variantBaseMap,
    averageCapacityMap,
  );
  const averageDiscount = round2(
    Array.from(averageDiscountMap.values()).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );
  const specialDiscount = round2(
    Array.from(specialDiscountMap.values()).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );

  const promotionDiscountAmount = round2(
    Array.from(promotionDiscountMap.values()).reduce(
      (sum, value) => sum + value,
      0,
    ),
  );

  const finalDiscount = round2(
    promotionDiscountAmount + averageDiscount + specialDiscount,
  );

  const total = round2(
    subtotal - finalDiscount + totalTax + round2(shippingCostNum),
  );

  const discountBreakdownByVariant: Record<number, DiscountBreakdown> = {};

  const discountedItems = selectedItems.map((item) => {
    const averageShare = Number(averageDiscountMap.get(item.variant_id) || 0);
    const promotionShare = Number(
      promotionDiscountMap.get(item.variant_id) || 0,
    );
    const specialShare = specialDiscountMap.get(item.variant_id)!;

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

    const totalItemDiscount = round2(
      averageShare + specialShare + promotionShare,
    );
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
    shippingCost: round2(shippingCostNum),
    total: Number(total),
  };
}
