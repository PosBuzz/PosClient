import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { item, promotion } from "../test/builders";
import type { Promotion } from "../types/promotion.types";
import type { SaleItem } from "../types/sale.types";
import { evaluatePromotionLocally } from "./promotion-validation";
const now = "2026-03-14T10:00:00Z";
function evaluate(
  p: Partial<Promotion> = {},
  rows: SaleItem[] = [item()],
  extra: Partial<Parameters<typeof evaluatePromotionLocally>[0]> = {},
) {
  return evaluatePromotionLocally({
    promotion: promotion(p),
    items: rows,
    branchId: 1,
    variantBrandById: { 1: 10, 2: 10 },
    ...extra,
  });
}
describe("promotion validation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
  });
  afterEach(() => vi.useRealTimers());
  it("[CO-PROMO-001] branch is required", () =>
    expect(evaluate({}, undefined, { branchId: null }).reason).toBe(
      "Please select a branch before applying a promotion",
    ));
  it.each([
    ["CO-PROMO-002", { is_active: false }, "Promotion is inactive"],
    [
      "CO-PROMO-003",
      { start_date: "2026-03-15" },
      "Promotion has not started yet",
    ],
    [
      "CO-PROMO-004",
      { end_date: "2026-03-13" },
      "Promotion has already expired",
    ],
    [
      "CO-PROMO-006",
      { branch_specific: true, branch_ids: [2] },
      "Promotion is not available for selected branch",
    ],
    [
      "CO-PROMO-007",
      { usage_limit: 1, sales_count: 1 },
      "Promotion usage limit reached and promo closed",
    ],
    [
      "CO-PROMO-008",
      { max_discount_amount: 10, total_discount_given: 10 },
      "Promotion max discount reached and promo closed",
    ],
    [
      "CO-PROMO-009",
      { member_only: true },
      "This promotion is for registered customers only",
    ],
    [
      "CO-PROMO-010",
      { limit_per_customer: true },
      "Select a registered customer to apply this promotion",
    ],
    [
      "CO-PROMO-012",
      { min_purchase: 101 },
      "Minimum purchase amount condition not met",
    ],
    [
      "CO-PROMO-013",
      { scope: "BRAND" },
      "Promotion brand is not configured correctly",
    ],
    [
      "CO-PROMO-014",
      { scope: "BRAND", brand_id: 99 },
      "No matching brand products found in cart",
    ],
    [
      "CO-PROMO-015",
      { variant_ids: [] },
      "Promotion has no products configured",
    ],
    [
      "CO-PROMO-016",
      { variant_ids: [2] },
      "Required product is not present in cart",
    ],
    [
      "CO-PROMO-017",
      { scope: "BUNDLE", variant_ids: [] },
      "Promotion has no products configured",
    ],
    [
      "CO-PROMO-018",
      { scope: "BUNDLE", variant_ids: [1, 2] },
      "Bundle conditions are not matched in cart",
    ],
    ["CO-PROMO-019", { min_quantity: 2 }, "Minimum quantity 2 not met"],
    [
      "CO-PROMO-020",
      { discount_value: 0 },
      "Promotion max discount reached and promo closed",
    ],
  ] as Array<[string, Partial<Promotion>, string]>)(
    "[%s] rejects ineligible promotion",
    (_id, p, reason) =>
      expect(evaluate(p), _id).toEqual({
        promotion_id: 1,
        is_eligible: false,
        reason,
      }),
  );
  it("[CO-PROMO-005] invalid date strings are ignored (characterization: confirm intent)", () =>
    expect(
      evaluate({ start_date: "invalid", end_date: "invalid" }).is_eligible,
    ).toBe(true));
  it("[CO-PROMO-006] missing branch lists are unavailable, matching lists qualify", () => {
    expect(
      evaluate({ branch_specific: true, branch_ids: [] }).is_eligible,
    ).toBe(false);
    expect(
      evaluate({
        branch_specific: true,
        branch_ids: undefined as unknown as number[],
      }).is_eligible,
    ).toBe(false);
    expect(
      evaluate({ branch_specific: true, branch_ids: [1] }).is_eligible,
    ).toBe(true);
  });
  it("[CO-PROMO-011] nonpositive quantities are ignored and an empty cart is rejected", () => {
    expect(
      evaluate({}, [item({ quantity: 0 }), item({ quantity: -1 })]).reason,
    ).toBe("Cart is empty");
    expect(evaluate({}, []).reason).toBe("Cart is empty");
  });
  it("[CO-PROMO-021] customer permits member and limited-customer promotions", () =>
    expect(
      evaluate({ member_only: true, limit_per_customer: true }, undefined, {
        customerId: 1,
      }).is_eligible,
    ).toBe(true));
  it("[CO-PROMO-022] brand scope matches only the selected brand", () =>
    expect(
      evaluate(
        { scope: "BRAND", brand_id: 10 },
        [item(), item({ variant_id: 2 })],
        { variantBrandById: { 1: 10, 2: 20 } },
      ),
    ).toMatchObject({ matched_variant_ids: [1], discount_amount: 10 }));
  it("[CO-PROMO-023] product relation fallback and bundle deduplication", () => {
    expect(
      evaluate({
        variant_ids: [],
        products: [
          {
            variant_id: 1,
            variant_name: "Default",
            product_id: 1,
            product_name: "Product",
          },
        ],
      }).is_eligible,
    ).toBe(true);
    expect(
      evaluate({ scope: "BUNDLE", variant_ids: [1, 1, 2] }, [
        item(),
        item({ variant_id: 2 }),
      ]),
    ).toMatchObject({ matched_variant_ids: [1, 2], discount_amount: 20 });
  });
  it("[CO-PROMO-024] quantity caps take expensive units first", () => {
    const rows = [
      item({ variant_id: 1, unit_price: 50, quantity: 2 }),
      item({ variant_id: 2, unit_price: 20, quantity: 3 }),
      item({ variant_id: 3, unit_price: 10, quantity: 1 }),
    ];
    expect(
      evaluate(
        { scope: "BUNDLE", variant_ids: [1, 2, 3], cap_quantity: 3 },
        rows,
      ),
    ).toMatchObject({ discount_base: 120, discount_amount: 12 });
    expect(
      evaluate({ cap_quantity: 5 }, [item({ quantity: 2 })]).discount_base,
    ).toBe(200);
  });
  it("[CO-PROMO-025] fixed per-unit discounts clamp to base", () => {
    expect(
      evaluate({ discount_type: "fixed_amount", discount_value: 15 }, [
        item({ quantity: 3 }),
      ]).discount_amount,
    ).toBe(45);
    expect(
      evaluate({ discount_type: "fixed_amount", discount_value: 500 })
        .discount_amount,
    ).toBe(100);
  });
  it("[CO-PROMO-026] positive cap and remaining global discount are respected", () => {
    expect(evaluate({ cap_discount_amount: 5 }).discount_amount).toBe(5);
    expect(
      evaluate({ max_discount_amount: 12, total_discount_given: 10 })
        .discount_amount,
    ).toBe(2);
  });
  it("[CO-PROMO-027] absent/nonpositive optional limits are not quantity restrictions", () => {
    for (const limit of [undefined, null, 0, -1]) {
      expect(
        evaluate(
          {
            usage_limit: limit as number,
            min_purchase: limit as number,
            cap_quantity: limit as number,
            cap_discount_amount: limit as number,
          },
          [item({ quantity: 2 })],
        ),
      ).toMatchObject({ discount_amount: 20, discount_base: 200 });
    }
    expect(
      evaluate({ end_date: undefined, usage_limit: 2, sales_count: 1 })
        .is_eligible,
    ).toBe(true);
    expect(evaluate({ min_purchase: 100, min_quantity: 1 }).is_eligible).toBe(
      true,
    );
  });
  it("[CO-PROMO-028] zero base produces no eligible discount", () =>
    expect(evaluate({}, [item({ unit_price: 0 })]).is_eligible).toBe(false));
  it("[CO-PROMO-050] duplicate variant lines aggregate quantity and base", () =>
    expect(
      evaluate({ min_quantity: 3 }, [item(), item({ quantity: 2 })]),
    ).toMatchObject({
      discount_amount: 30,
      discount_base: 300,
      matched_variant_ids: [1],
    }));
  it("[CO-PROMO-051] price times quantity wins; zero price falls back to supplied line", () => {
    expect(
      evaluate({}, [
        item({ unit_price: 115, tax_method: "INCLUSIVE", tax_percentage: 15 }),
      ]).discount_base,
    ).toBe(115);
    const row = item({ unit_price: 0 });
    row.line_total = 50;
    expect(evaluate({}, [row]).discount_base).toBe(50);
  });
  it("[CO-PROMO-052] exact start/end instant is eligible", () =>
    expect(evaluate({ start_date: now, end_date: now }).is_eligible).toBe(
      true,
    ));
});

describe("promotion validation boundaries", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
  });
  afterEach(() => vi.useRealTimers());
  const two = [
    item({ variant_id: 1, unit_price: 100, quantity: 2 }),
    item({ variant_id: 2, unit_price: 50, quantity: 4 }),
  ];
  const bundle = { scope: "BUNDLE" as const, variant_ids: [1, 2] };

  it("[CO-PROMO-030] a promotion without variant_ids falls back to its products list", () => {
    const r = evaluate({
      variant_ids: undefined,
      products: [{ variant_id: 1 } as never],
    });
    expect(r.is_eligible).toBe(true);
    expect(r.matched_variant_ids).toEqual([1]);
  });

  it("[CO-PROMO-031] a quantity cap limits a fixed discount to the capped units", () => {
    const r = evaluate(
      { discount_type: "fixed_amount", discount_value: 7, cap_quantity: 3 },
      [item({ unit_price: 100, quantity: 5 })],
    );
    expect(r.discount_amount).toBe(21);
  });

  it("[CO-PROMO-032] a cap bigger than the matched quantity changes nothing", () => {
    const r = evaluate(
      { cap_quantity: 10, discount_value: 10 },
      two.slice(0, 1),
    );
    expect(r.discount_base).toBe(200);
    expect(r.discount_amount).toBe(20);
  });

  it("[CO-PROMO-033] a cap equal to the matched quantity keeps the whole base", () => {
    const r = evaluate({ ...bundle, cap_quantity: 6, discount_value: 10 }, two);
    expect(r.discount_base).toBe(400);
  });

  it("[CO-PROMO-034] a quantity cap discounts the dearest units first, whatever the cart order", () => {
    const cheapFirst = [
      item({ variant_id: 2, unit_price: 50, quantity: 4 }),
      item({ variant_id: 3, unit_price: 20, quantity: 4 }),
      item({ variant_id: 1, unit_price: 100, quantity: 2 }),
    ];
    const r = evaluate(
      {
        scope: "BUNDLE",
        variant_ids: [2, 3, 1],
        cap_quantity: 3,
        discount_value: 10,
      },
      cheapFirst,
    );
    // 2 units at 100 and 1 unit at 50
    expect(r.discount_base).toBe(250);
    expect(r.discount_amount).toBe(25);
  });

  it("[CO-PROMO-035] a null or missing maximum discount means unlimited", () => {
    for (const max_discount_amount of [null, undefined]) {
      const r = evaluate({ max_discount_amount: max_discount_amount as never });
      expect(r.is_eligible).toBe(true);
      expect(r.discount_amount).toBe(10);
    }
  });

  it("[CO-PROMO-036] the remaining maximum discount trims the discount and closes at zero", () => {
    expect(
      evaluate({ max_discount_amount: 15, total_discount_given: 10 })
        .discount_amount,
    ).toBe(5);
    expect(
      evaluate({ max_discount_amount: 15, total_discount_given: 15 }).reason,
    ).toBe("Promotion max discount reached and promo closed");
  });
});
