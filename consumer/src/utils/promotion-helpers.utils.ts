import {
  Promotion,
  PromotionValidationResponse,
} from "../types/promotion.types";
import { ProductVariantForSale, SaleItem } from "../types/sale.types";
import { evaluatePromotionLocally } from "./promotion-validation";

export function getVariantBrandByIdMap(
  filteredVariants: ProductVariantForSale[],
): Record<number, number | undefined> {
  const map: Record<number, number | undefined> = {};
  for (const variant of filteredVariants) {
    map[variant.id] = variant.brand_id ? Number(variant.brand_id) : undefined;
  }
  return map;
}

export function evaluatePromotionForItems(params: {
  promotion: Promotion;
  items: SaleItem[];
  branchId: number | null;
  customerId?: number;
  variantBrandById: Record<number, number | undefined>;
}): PromotionValidationResponse {
  return evaluatePromotionLocally(params);
}

export function getPromotionRequiredVariantIds(promotion: Promotion): number[] {
  if (promotion.scope === "BRAND") {
    return [];
  }
  return promotion.variant_ids?.length > 0
    ? promotion.variant_ids
    : promotion.products?.map((item) => item.variant_id) || [];
}

export function getPromotionCandidateVariants(
  promotion: Promotion,
  filteredVariants: ProductVariantForSale[],
): ProductVariantForSale[] {
  if (promotion.scope === "BRAND") {
    return filteredVariants.filter(
      (variant) =>
        promotion.brand_id &&
        Number(variant.brand_id) === Number(promotion.brand_id),
    );
  }

  const requiredIds = getPromotionRequiredVariantIds(promotion);
  return requiredIds
    .map((variantId) =>
      filteredVariants.find((variant) => variant.id === variantId),
    )
    .filter(Boolean) as ProductVariantForSale[];
}

export function enrichCartForPromotion(params: {
  promotion: Promotion;
  sourceItems: SaleItem[];
  filteredVariants: ProductVariantForSale[];
  getVariantPriceFn: (variant: ProductVariantForSale) => number;
  upsertFn: (
    items: SaleItem[],
    variant: ProductVariantForSale,
    qty: number,
  ) => SaleItem[];
  reason?: string;
}): { items: SaleItem[]; changed: boolean } {
  const {
    promotion,
    sourceItems,
    filteredVariants,
    getVariantPriceFn,
    upsertFn,
    reason,
  } = params;

  let nextItems = [...sourceItems];
  let changed = false;
  const reasonMentions = (phrase: string) =>
    reason?.toLowerCase().includes(phrase) ?? false;

  const requiredIds = getPromotionRequiredVariantIds(promotion);
  const requiredVariants = requiredIds
    .map((variantId) =>
      filteredVariants.find((variant) => variant.id === variantId),
    )
    .filter(Boolean) as ProductVariantForSale[];

  // Brand promotions have no required variants, so this loop is a no-op for them.
  const existingIds = new Set(nextItems.map((item) => item.variant_id));
  for (const variant of requiredVariants) {
    if (!existingIds.has(variant.id)) {
      nextItems = upsertFn(nextItems, variant, 1);
      changed = true;
    }
  }

  const candidateVariants = getPromotionCandidateVariants(
    promotion,
    filteredVariants,
  );
  const highestPriceVariant = [...candidateVariants].sort(
    (a, b) => getVariantPriceFn(b) - getVariantPriceFn(a),
  )[0];

  if (!highestPriceVariant) {
    return { items: nextItems, changed };
  }

  const candidateIds = new Set(candidateVariants.map((variant) => variant.id));
  const currentMatchedQty = nextItems.reduce((sum, item) => {
    return candidateIds.has(item.variant_id)
      ? sum + Number(item.quantity || 0)
      : sum;
  }, 0);

  const minQty = Number(promotion.min_quantity || 1);
  const minPurchase = Number(promotion.min_purchase || 0);

  const needsMinQty =
    currentMatchedQty < minQty || reasonMentions("minimum quantity");
  if (needsMinQty) {
    const qtyToAdd = Math.max(1, minQty - currentMatchedQty);
    nextItems = upsertFn(nextItems, highestPriceVariant, qtyToAdd);
    changed = true;
  }

  const recalculatedSubtotal = nextItems.reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0,
  );
  const needsMinPurchase =
    recalculatedSubtotal < minPurchase || reasonMentions("minimum purchase");

  if (needsMinPurchase) {
    const unitPrice = Math.max(0.01, getVariantPriceFn(highestPriceVariant));
    const qtyToAdd = Math.max(
      1,
      Math.ceil(Math.max(0, minPurchase - recalculatedSubtotal) / unitPrice),
    );
    nextItems = upsertFn(nextItems, highestPriceVariant, qtyToAdd);
    changed = true;
  }

  if (
    !changed &&
    (reasonMentions("required product") ||
      reasonMentions("bundle") ||
      reasonMentions("no matching brand"))
  ) {
    nextItems = upsertFn(nextItems, highestPriceVariant, 1);
    changed = true;
  }

  return { items: nextItems, changed };
}
