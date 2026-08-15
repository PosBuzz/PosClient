import { UseQueryResult } from "@tanstack/react-query";
import { MessageInstance } from "antd/es/message/interface";
import { useEffect, useRef, useState } from "react";
import { Customer, ProductVariantForSale, SaleItem } from "../types/sale.types";
import { Promotion } from "../types/promotion.types";
import {
  evaluatePromotionForItems as evaluatePromotionForItemsShared,
  enrichCartForPromotion,
  getVariantBrandByIdMap,
} from "../utils/promotion-helpers.utils";

interface UsePromotionManagerOptions {
  selectedItems: SaleItem[];
  selectedBranch: number | null;
  selectedCustomer: Customer | null;
  filteredVariants: ProductVariantForSale[];
  activePromotionsQuery: UseQueryResult<Promotion[]>;
  setSelectedItems: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  upsertFn: (
    items: SaleItem[],
    variant: ProductVariantForSale,
    qty: number,
  ) => SaleItem[];
  getVariantPriceFn: (variant: ProductVariantForSale) => number;
  messageApi: MessageInstance | null;
  shouldSkipAutoApply?: () => boolean;
}

export const usePromotionManager = ({
  selectedItems,
  selectedBranch,
  selectedCustomer,
  filteredVariants,
  activePromotionsQuery,
  setSelectedItems,
  upsertFn,
  getVariantPriceFn,
  messageApi,
  shouldSkipAutoApply,
}: UsePromotionManagerOptions) => {
  const [appliedPromotions, setAppliedPromotions] = useState<Promotion[]>([]);
  const [dismissedAutoPromotionIds, setDismissedAutoPromotionIds] = useState<
    number[]
  >([]);
  const [applyingPromotionId, setApplyingPromotionId] = useState<number | null>(
    null,
  );
  const [promotionEligibilityMap, setPromotionEligibilityMap] = useState<
    Record<number, { is_eligible: boolean; reason?: string }>
  >({});
  const [promotionDrawerOpen, setPromotionDrawerOpen] = useState(false);
  const previousBranchRef = useRef<number | null>(selectedBranch);

  const variantBrandById = getVariantBrandByIdMap(filteredVariants);

  useEffect(() => {
    if (previousBranchRef.current === selectedBranch) {
      return;
    }

    previousBranchRef.current = selectedBranch;
    setAppliedPromotions([]);
    setDismissedAutoPromotionIds([]);
    setPromotionEligibilityMap({});
  }, [selectedBranch]);

  const evaluatePromotionForItems = (
    promotion: Promotion,
    items: SaleItem[],
  ) => {
    return evaluatePromotionForItemsShared({
      promotion,
      items,
      branchId: selectedBranch,
      customerId: selectedCustomer?.id,
      variantBrandById,
    });
  };

  // Auto-apply promotions when cart changes
  useEffect(() => {
    const tryAutoApplyPromotions = async () => {
      if (shouldSkipAutoApply?.()) return;

      if (
        selectedItems.length === 0 ||
        !selectedBranch ||
        !activePromotionsQuery.data ||
        activePromotionsQuery.data.length === 0
      ) {
        return;
      }

      const autoApplyPromotions = activePromotionsQuery.data.filter(
        (p) => p.auto_apply && p.is_active,
      );

      if (autoApplyPromotions.length === 0) return;

      // Retain dismissed IDs only while they stay eligible
      setDismissedAutoPromotionIds((prev) => {
        if (prev.length === 0) return prev;
        const retained = prev.filter((promotionId) => {
          const promotion = autoApplyPromotions.find(
            (p) => p.id === promotionId,
          );
          if (!promotion) return false;
          return evaluatePromotionForItems(promotion, selectedItems)
            .is_eligible;
        });
        return retained.length === prev.length ? prev : retained;
      });

      const alreadyAppliedIds = new Set(appliedPromotions.map((p) => p.id));
      const dismissedIds = new Set(dismissedAutoPromotionIds);
      const promotionsToAdd: Promotion[] = [];

      for (const promotion of autoApplyPromotions) {
        if (
          alreadyAppliedIds.has(promotion.id) ||
          dismissedIds.has(promotion.id)
        )
          continue;
        if (evaluatePromotionForItems(promotion, selectedItems).is_eligible) {
          promotionsToAdd.push(promotion);
        }
      }

      if (promotionsToAdd.length > 0) {
        setAppliedPromotions((prev) => [...prev, ...promotionsToAdd]);
        messageApi?.success(
          `${promotionsToAdd.map((p) => p.name).join(", ")} auto-applied`,
        );
      }
    };

    tryAutoApplyPromotions();
  }, [
    selectedItems,
    selectedBranch,
    selectedCustomer?.id,
    activePromotionsQuery.data,
    appliedPromotions,
    dismissedAutoPromotionIds,
  ]);

  // Evaluate all promotions when drawer opens
  useEffect(() => {
    let cancelled = false;

    const evaluatePromotionsForCurrentCart = async () => {
      if (
        !promotionDrawerOpen ||
        !selectedBranch ||
        !activePromotionsQuery.data ||
        activePromotionsQuery.data.length === 0 ||
        selectedItems.length === 0
      ) {
        setPromotionEligibilityMap({});
        return;
      }

      const evaluations = await Promise.all(
        activePromotionsQuery.data.map(async (promotion) => {
          const validation = evaluatePromotionForItems(
            promotion,
            selectedItems,
          );
          return [promotion.id, validation] as const;
        }),
      );

      if (cancelled) return;
      setPromotionEligibilityMap(Object.fromEntries(evaluations));
    };

    evaluatePromotionsForCurrentCart();
    return () => {
      cancelled = true;
    };
  }, [
    promotionDrawerOpen,
    selectedBranch,
    selectedCustomer?.id,
    selectedItems,
    activePromotionsQuery.data,
  ]);

  // Remove ineligible promotions when cart changes
  useEffect(() => {
    if (shouldSkipAutoApply?.()) return;
    if (appliedPromotions.length === 0) return;

    if (!selectedBranch || selectedItems.length === 0) {
      setAppliedPromotions([]);
      if (selectedItems.length === 0) {
        messageApi?.warning("Applied promotions removed: cart is empty");
      }
      return;
    }

    const kept: Promotion[] = [];
    const removed: string[] = [];

    appliedPromotions.forEach((promotion) => {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (validation.is_eligible) {
        kept.push(promotion);
      } else {
        removed.push(promotion.name);
      }
    });

    if (removed.length > 0) {
      setAppliedPromotions(kept);
      messageApi?.warning(
        `Removed ineligible promotions: ${removed.join(", ")}`,
      );
    }
  }, [
    appliedPromotions,
    selectedItems,
    selectedBranch,
    selectedCustomer?.id,
    variantBrandById,
  ]);

  const removeAppliedPromotion = (promotionId: number) => {
    const promotion = appliedPromotions.find((p) => p.id === promotionId);
    if (promotion?.auto_apply) {
      const validation = evaluatePromotionForItems(promotion, selectedItems);
      if (validation.is_eligible) {
        setDismissedAutoPromotionIds((prev) =>
          prev.includes(promotionId) ? prev : [...prev, promotionId],
        );
      }
    }
    setAppliedPromotions((prev) => prev.filter((p) => p.id !== promotionId));
  };

  const clearAppliedPromotions = () => {
    const autoEligiblePromotionIds = appliedPromotions
      .filter((promotion) => {
        if (!promotion.auto_apply) return false;
        return evaluatePromotionForItems(promotion, selectedItems).is_eligible;
      })
      .map((promotion) => promotion.id);

    if (autoEligiblePromotionIds.length > 0) {
      setDismissedAutoPromotionIds((prev) =>
        Array.from(new Set([...prev, ...autoEligiblePromotionIds])),
      );
    }
    setAppliedPromotions([]);
  };

  const doEnrichCartForPromotion = (
    promotion: Promotion,
    sourceItems: SaleItem[],
    reason?: string,
  ) => {
    return enrichCartForPromotion({
      promotion,
      sourceItems,
      filteredVariants,
      getVariantPriceFn,
      upsertFn,
      reason,
    });
  };

  const applyPromotion = (promotion: Promotion) => {
    if (!selectedBranch) {
      messageApi?.error("Please select a branch before applying a promotion");
      return;
    }

    if (appliedPromotions.some((p) => p.id === promotion.id)) {
      messageApi?.info(`${promotion.name} is already applied`);
      return;
    }

    let workingItems = [...selectedItems];
    let cartUpdated = false;

    setApplyingPromotionId(promotion.id);

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (workingItems.length === 0) {
          const enriched = doEnrichCartForPromotion(promotion, workingItems);
          if (enriched.changed) {
            workingItems = enriched.items;
            cartUpdated = true;
          }
        }

        if (workingItems.length === 0) break;

        const validation = evaluatePromotionForItems(promotion, workingItems);

        if (validation.is_eligible) {
          if (cartUpdated) setSelectedItems(workingItems);
          setAppliedPromotions((prev) => [...prev, promotion]);
          messageApi?.success(`${promotion.name} applied`);
          setPromotionDrawerOpen(false);
          return;
        }

        const enriched = doEnrichCartForPromotion(
          promotion,
          workingItems,
          validation.reason,
        );

        if (!enriched.changed) {
          if (cartUpdated) setSelectedItems(workingItems);
          messageApi?.error(
            validation.reason || "Promotion conditions not matched",
          );
          return;
        }

        workingItems = enriched.items;
        cartUpdated = true;
      }

      if (cartUpdated) setSelectedItems(workingItems);
      messageApi?.error("Promotion conditions not matched");
    } finally {
      setApplyingPromotionId(null);
    }
  };

  return {
    appliedPromotions,
    setAppliedPromotions,
    dismissedAutoPromotionIds,
    setDismissedAutoPromotionIds,
    applyingPromotionId,
    setApplyingPromotionId,
    promotionEligibilityMap,
    setPromotionEligibilityMap,
    promotionDrawerOpen,
    setPromotionDrawerOpen,
    variantBrandById,
    evaluatePromotionForItems,
    removeAppliedPromotion,
    clearAppliedPromotions,
    applyPromotion,
  };
};
