import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { item, promotion, variant } from "../test/builders";
import type { SaleItem } from "../types/sale.types";
import { PriceType } from "../types/sale.types";
import { upsertVariantInSaleItems } from "../utils/sale-item.utils";

const upsertFn = (sourceItems: SaleItem[], v: any, quantityToAdd: number) =>
  upsertVariantInSaleItems({
    sourceItems,
    variant: v,
    quantityToAdd,
    priceType: PriceType.REGULAR,
  });
import { usePromotionManager } from "./usePromotionManager";

const messageApi = () =>
  ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }) as any;

function setup(over: Record<string, unknown> = {}) {
  const messages = messageApi();
  const setSelectedItems = vi.fn();
  const props = {
    selectedItems: [item({ variant_id: 1 })] as SaleItem[],
    selectedBranch: 1 as number | null,
    selectedCustomer: null,
    filteredVariants: [variant({ id: 1 })],
    activePromotionsQuery: { data: [promotion({ id: 1 })] } as any,
    setSelectedItems,
    upsertFn,
    getVariantPriceFn: (v: any) => v.regular_price,
    messageApi: messages,
    ...over,
  };
  const hook = renderHook((p: typeof props) => usePromotionManager(p), {
    initialProps: props,
  });
  return { ...hook, props, messages, setSelectedItems };
}

describe("usePromotionManager", () => {
  it("[CO-HOOK-002] auto-applies an eligible auto promotion once and says so", () => {
    const { result, messages } = setup();
    expect(result.current.appliedPromotions.map((p) => p.id)).toEqual([1]);
    expect(messages.success).toHaveBeenCalledWith("Offer auto-applied");
    expect(messages.success).toHaveBeenCalledTimes(1);
  });

  it("[CO-HOOK-002] does not auto-apply a manual promotion or an inactive one", () => {
    const { result } = setup({
      activePromotionsQuery: {
        data: [
          promotion({ id: 1, auto_apply: false }),
          promotion({ id: 2, is_active: false }),
        ],
      },
    });
    expect(result.current.appliedPromotions).toEqual([]);
  });

  it("[CO-HOOK-002] removing an auto-applied promotion dismisses it so it does not come back", () => {
    const { result } = setup();
    act(() => result.current.removeAppliedPromotion(1));
    expect(result.current.appliedPromotions).toEqual([]);
    expect(result.current.dismissedAutoPromotionIds).toEqual([1]);
  });

  it("[CO-HOOK-002] clearing all dismisses the eligible auto ones", () => {
    const { result } = setup();
    act(() => result.current.clearAppliedPromotions());
    expect(result.current.appliedPromotions).toEqual([]);
    expect(result.current.dismissedAutoPromotionIds).toEqual([1]);
  });

  it("[CO-HOOK-002] emptying the cart drops applied promotions with a warning", () => {
    const { result, rerender, props, messages } = setup();
    rerender({ ...props, selectedItems: [] });
    expect(result.current.appliedPromotions).toEqual([]);
    expect(messages.warning).toHaveBeenCalledWith(
      "Applied promotions removed: cart is empty",
    );
  });

  it("[CO-HOOK-002] changing the cart so a promotion no longer qualifies removes it and names it", () => {
    const { result, rerender, props, messages } = setup();
    rerender({ ...props, selectedItems: [item({ variant_id: 2 })] });
    expect(result.current.appliedPromotions).toEqual([]);
    expect(messages.warning).toHaveBeenCalledWith(
      "Removed ineligible promotions: Offer",
    );
  });

  it("[CO-HOOK-002] switching branch resets applied, dismissed and eligibility state", () => {
    const { result, rerender, props } = setup();
    act(() => result.current.removeAppliedPromotion(1));
    rerender({ ...props, selectedBranch: 2 });
    expect(result.current.dismissedAutoPromotionIds).toEqual([]);
  });

  it("[CO-HOOK-002] manually applying needs a branch, refuses duplicates, and reports unmet conditions", () => {
    const manual = promotion({ id: 5, name: "Manual", auto_apply: false });
    const noBranch = setup({ selectedBranch: null });
    act(() => noBranch.result.current.applyPromotion(manual));
    expect(noBranch.messages.error).toHaveBeenCalledWith(
      "Please select a branch before applying a promotion",
    );

    const { result, messages } = setup({
      activePromotionsQuery: { data: [] },
      selectedItems: [item({ variant_id: 1 })],
    });
    act(() => result.current.applyPromotion(manual));
    expect(result.current.appliedPromotions.map((p) => p.id)).toEqual([5]);
    expect(messages.success).toHaveBeenCalledWith("Manual applied");
    act(() => result.current.applyPromotion(manual));
    expect(messages.info).toHaveBeenCalledWith("Manual is already applied");

    const other = setup({
      activePromotionsQuery: { data: [] },
      selectedItems: [item({ variant_id: 9 })],
      filteredVariants: [],
    });
    act(() => other.result.current.applyPromotion(manual));
    expect(other.messages.error).toHaveBeenCalled();
    expect(other.result.current.appliedPromotions).toEqual([]);
  });
});
