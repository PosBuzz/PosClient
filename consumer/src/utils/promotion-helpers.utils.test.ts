import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { item, promotion, variant } from "../test/builders";
import { PriceType, type SaleItem } from "../types/sale.types";
import {
  getVariantPriceForSale,
  upsertVariantInSaleItems,
} from "./sale-item.utils";
import {
  getVariantBrandByIdMap,
  evaluatePromotionForItems,
  getPromotionRequiredVariantIds,
  getPromotionCandidateVariants,
  enrichCartForPromotion,
} from "./promotion-helpers.utils";
function enrich(
  extra: Partial<Parameters<typeof enrichCartForPromotion>[0]> = {},
) {
  return enrichCartForPromotion({
    promotion: promotion(),
    sourceItems: [],
    filteredVariants: [
      variant(),
      variant({ id: 2, regular_price: 200, brand_id: 10 }),
    ],
    getVariantPriceFn: (v) => getVariantPriceForSale(v, PriceType.REGULAR),
    upsertFn: (rows, v, qty) =>
      upsertVariantInSaleItems({
        sourceItems: rows,
        variant: v,
        quantityToAdd: qty,
        priceType: PriceType.REGULAR,
      }),
    ...extra,
  });
}
describe("promotion cart helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("[CO-PH-001] brand map retains absent brands", () =>
    expect(
      getVariantBrandByIdMap([variant({ brand_id: 10 }), variant({ id: 2 })]),
    ).toEqual({ 1: 10, 2: undefined }));
  it("[CO-PH-002] evaluation delegates to the real local evaluator", () =>
    expect(
      evaluatePromotionForItems({
        promotion: promotion(),
        items: [item()],
        branchId: 1,
        variantBrandById: {},
      }),
    ).toMatchObject({ is_eligible: true, discount_amount: 10 }));
  it("[CO-PH-003] required products use direct ids, relation fallback, or empty brand scope", () => {
    expect(
      getPromotionRequiredVariantIds(promotion({ scope: "BRAND" })),
    ).toEqual([]);
    expect(getPromotionRequiredVariantIds(promotion())).toEqual([1]);
    expect(
      getPromotionRequiredVariantIds(
        promotion({
          variant_ids: [],
          products: [
            {
              variant_id: 2,
              variant_name: "V",
              product_id: 2,
              product_name: "P",
            },
          ],
        }),
      ),
    ).toEqual([2]);
    expect(
      getPromotionRequiredVariantIds(
        promotion({
          variant_ids: undefined as unknown as number[],
          products: undefined,
        }),
      ),
    ).toEqual([]);
  });
  it("[CO-PH-004] candidates ignore absent products and unmatched brands", () => {
    const rows = [variant({ brand_id: 10 }), variant({ id: 2, brand_id: 20 })];
    expect(
      getPromotionCandidateVariants(promotion({ variant_ids: [1, 3] }), rows),
    ).toEqual([rows[0]]);
    expect(
      getPromotionCandidateVariants(
        promotion({ scope: "BRAND", brand_id: 10 }),
        rows,
      ),
    ).toEqual([rows[0]]);
    expect(
      getPromotionCandidateVariants(promotion({ scope: "BRAND" }), rows),
    ).toEqual([]);
  });
  it("[CO-PH-005] inserts missing required products without mutating the source", () => {
    const source: SaleItem[] = [];
    expect(
      enrich({
        sourceItems: source,
        promotion: promotion({ scope: "BUNDLE", variant_ids: [1, 2] }),
      }),
    ).toMatchObject({
      changed: true,
      items: [
        { variant_id: 1, quantity: 1 },
        { variant_id: 2, quantity: 1 },
      ],
    });
    expect(source).toEqual([]);
  });
  it("[CO-PH-006] missing candidates leave the cart unchanged", () =>
    expect(
      enrich({
        promotion: promotion({ variant_ids: [99] }),
        sourceItems: [item()],
      }),
    ).toEqual({ changed: false, items: [item()] }));
  it("[CO-PH-007] minimum quantity adds units of the most expensive candidate", () =>
    expect(
      enrich({
        promotion: promotion({ scope: "BRAND", brand_id: 10, min_quantity: 3 }),
      }),
    ).toMatchObject({
      changed: true,
      items: [{ variant_id: 2, quantity: 3 }],
    }));
  it("[CO-PH-008] minimum purchase adds enough units", () =>
    expect(
      enrich({
        promotion: promotion({ min_purchase: 250 }),
        sourceItems: [item()],
      }),
    ).toMatchObject({
      changed: true,
      items: [{ variant_id: 1, quantity: 3 }],
    }));
  it("[CO-PH-009] reason-driven minimum quantity/purchase adds at least one", () => {
    for (const reason of ["Minimum quantity", "Minimum purchase"]) {
      expect(enrich({ sourceItems: [item()], reason })).toMatchObject({
        changed: true,
        items: [{ quantity: 2 }],
      });
    }
  });
  it("[CO-PH-010] reason-driven required/bundle/brand fallback adds a unit", () => {
    for (const reason of [
      "Required product",
      "Bundle conditions",
      "No matching brand",
    ]) {
      expect(enrich({ sourceItems: [item()], reason })).toMatchObject({
        changed: true,
        items: [{ quantity: 2 }],
      });
    }
  });
  it("[CO-PH-011] already qualifying cart is unchanged and unrelated lines survive", () => {
    const rows = [item(), item({ variant_id: 3, quantity: 0, line_total: 0 })];
    expect(enrich({ sourceItems: rows })).toEqual({
      changed: false,
      items: rows,
    });
  });
  it("[CO-PH-012] zero-price candidates use a finite minimum-purchase divisor", () => {
    const result = enrich({
      sourceItems: [item({ unit_price: 0 })],
      filteredVariants: [variant({ regular_price: 0 })],
      promotion: promotion({ min_purchase: 1 }),
    });
    expect(result.changed).toBe(true);
    expect(result.items[0].quantity).toBe(101);
  });
});

it("[CO-PH-013] zero-quantity matching lines are enriched to the minimum", () => {
  expect(enrich({ sourceItems: [item({ quantity: 0 })] })).toMatchObject({
    changed: true,
    items: [{ quantity: 1 }],
  });
});
