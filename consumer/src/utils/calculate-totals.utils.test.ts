import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { item, promotion } from "../test/builders";
import { DiscountType, type SaleItem } from "../types/sale.types";
import type { PromotionValidationResponse } from "../types/promotion.types";
import { calculateSaleTotals } from "./calculate-totals.utils";
const round = (n: number) => Number(n.toFixed(2));
const options = { seed: 424242, numRuns: 500 };
const none = () => ({ promotion_id: 1, is_eligible: false });
function totals(
  rows: SaleItem[],
  extra: Partial<Parameters<typeof calculateSaleTotals>[0]> = {},
) {
  return calculateSaleTotals({
    selectedItems: rows,
    averageDiscountAmount: 0,
    averageDiscountType: DiscountType.FLAT,
    shippingCost: 0,
    appliedPromotions: [],
    evaluatePromotionFn: none,
    ...extra,
  });
}
const cart = fc
  .array(
    fc.record({
      price: fc.integer({ min: 1, max: 10000000 }),
      quantity: fc.integer({ min: 1, max: 50 }),
      tax: fc.integer({ min: 0, max: 2500 }),
      method: fc.constantFrom("EXCLUSIVE", "INCLUSIVE"),
      specialPercent: fc.integer({ min: 0, max: 100 }),
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((rows) =>
    rows.map((row, index) =>
      item({
        variant_id: index + 1,
        unit_price: row.price / 100,
        regular_price: row.price / 100,
        quantity: row.quantity,
        tax_percentage: row.tax / 100,
        tax_method: row.method,
        special_discount_amount: round(
          ((row.price / 100) * row.quantity * row.specialPercent) / 100,
        ),
      }),
    ),
  );
const scenario = fc.record({
  rows: cart,
  average: fc.integer({ min: 0, max: 100 }),
  shipping: fc.integer({ min: 0, max: 100000 }),
  percentage: fc.boolean(),
});
function run(s: {
  rows: SaleItem[];
  average: number;
  shipping: number;
  percentage: boolean;
}) {
  const base = s.rows.reduce(
    (sum, row) => sum + row.unit_price * row.quantity,
    0,
  );
  return totals(s.rows, {
    averageDiscountAmount: s.percentage
      ? s.average
      : round((base * s.average) / 100),
    averageDiscountType: s.percentage
      ? DiscountType.PERCENTAGE
      : DiscountType.FLAT,
    shippingCost: s.shipping / 100,
  });
}
// Mirror sales.service.ts#create reconstruction (subtotal, tax, line discounts, shipping).
function backendTotalsFrom(rows: SaleItem[], shipping: number) {
  const discount = rows.reduce(
    (sum, row) =>
      sum +
      (row.average_discount_amount ?? 0) +
      (row.special_discount_amount ?? 0) +
      (row.promotion_discount_amount ?? 0),
    0,
  );
  const tax = rows.reduce((sum, row) => sum + (row.tax_amount ?? 0), 0);
  const subtotal = rows.reduce(
    (sum, row) =>
      sum +
      row.line_total +
      (row.average_discount_amount ?? 0) +
      (row.special_discount_amount ?? 0) +
      (row.promotion_discount_amount ?? 0) -
      (row.tax_amount ?? 0),
    0,
  );
  return {
    subtotal: round(subtotal),
    tax: round(tax),
    discount: round(discount),
    total: round(subtotal - discount + tax + shipping),
  };
}
describe("sale totals examples", () => {
  it("[CO-TOT-001] empty cart has zero totals", () => {
    expect(totals([])).toMatchObject({
      subtotal: 0,
      totalTax: 0,
      total: 0,
      finalDiscount: 0,
      discountedItems: [],
      discountBreakdownByVariant: {},
    });
  });
  it("[CO-TOT-002] exclusive tax", () =>
    expect(totals([item({ quantity: 2, tax_percentage: 5 })])).toMatchObject({
      subtotal: 200,
      totalTax: 10,
      total: 210,
    }));
  it("[CO-TOT-003] inclusive tax", () =>
    expect(
      totals([
        item({ unit_price: 115, tax_percentage: 15, tax_method: "INCLUSIVE" }),
      ]),
    ).toMatchObject({ subtotal: 100, totalTax: 15, total: 115 }));
  it("[CO-TOT-004] mixed tax methods reconcile", () =>
    expect(
      totals([
        item({ variant_id: 1, quantity: 2, tax_percentage: 5 }),
        item({
          variant_id: 2,
          unit_price: 115,
          tax_percentage: 15,
          tax_method: "INCLUSIVE",
        }),
        item({ variant_id: 3, unit_price: 50 }),
      ]),
    ).toMatchObject({ subtotal: 350, totalTax: 25, total: 375 }));
  it("[CO-TOT-005] flat discounts are proportional to base", () => {
    const r = totals([item(), item({ variant_id: 2, unit_price: 200 })], {
      averageDiscountAmount: 30,
    });
    expect(r.discountedItems.map((row) => row.average_discount_amount)).toEqual(
      [10, 20],
    );
    expect(r.finalDiscount).toBe(30);
  });
  it("[CO-TOT-006] remainder goes to the last eligible line", () => {
    const r = totals(
      [item(), item({ variant_id: 2 }), item({ variant_id: 3 })],
      { averageDiscountAmount: 10 },
    );
    expect(r.discountedItems.map((row) => row.average_discount_amount)).toEqual(
      [3.33, 3.33, 3.34],
    );
  });
  it("[CO-TOT-007] percentage average discount uses price times quantity, including inclusive tax", () =>
    expect(
      totals(
        [
          item({
            unit_price: 115,
            tax_percentage: 15,
            tax_method: "INCLUSIVE",
          }),
        ],
        {
          averageDiscountType: DiscountType.PERCENTAGE,
          averageDiscountAmount: 10,
        },
      ),
    ).toMatchObject({ subtotal: 100, averageDiscount: 11.5, total: 103.5 }));
  it("[CO-TOT-008] special discounts affect only their own line", () => {
    const r = totals([
      item({ special_discount_amount: 20 }),
      item({ variant_id: 2 }),
    ]);
    expect(r.specialDiscount).toBe(20);
    expect(r.discountedItems.map((row) => row.special_discount_amount)).toEqual(
      [20, 0],
    );
  });
  it("[CO-TOT-009] shipping is rounded and added", () =>
    expect(totals([item()], { shippingCost: 60.123 })).toMatchObject({
      shippingCost: 60.12,
      total: 160.12,
    }));
  it("[CO-TOT-010] line totals and sold prices reflect allocated discounts", () => {
    const r = totals([item({ quantity: 2, special_discount_amount: 10 })], {
      averageDiscountAmount: 20,
    });
    expect(r.discountedItems[0]).toMatchObject({
      line_total: 170,
      sold_unit_price: 85,
      unit_price: 100,
    });
  });
  it("[CO-TOT-011] every variant has a consistent breakdown", () => {
    const r = totals(
      [item(), item({ variant_id: 2, special_discount_amount: 10 })],
      { averageDiscountAmount: 20 },
    );
    expect(Object.keys(r.discountBreakdownByVariant)).toEqual(["1", "2"]);
    for (const b of Object.values(r.discountBreakdownByVariant)) {
      expect(b.total).toBe(round(b.average + b.special + b.promotion));
    }
  });
  it("[CO-TOT-012] tax remains based on the pre-discount price (characterization: confirm intent)", () =>
    expect(
      totals([item({ tax_percentage: 5, special_discount_amount: 20 })]),
    ).toMatchObject({ subtotal: 100, totalTax: 5, total: 85 }));
  it("[CO-TOT-031] tiny discount allocation cannot produce negative shares", () => {
    const r = totals(
      [1, 2, 3, 4].map((id) => item({ variant_id: id, unit_price: 0.01 })),
      { averageDiscountAmount: 0.02 },
    );
    expect(
      r.discountedItems.every((row) => (row.average_discount_amount ?? 0) >= 0),
    ).toBe(true);
    expect(
      round(
        r.discountedItems.reduce(
          (sum, row) => sum + (row.average_discount_amount ?? 0),
          0,
        ),
      ),
    ).toBe(0.02);
  });
  it("[CO-TOT-032] aliases and rounding reconstruct the same subtotal as the backend", () => {
    for (const row of [
      item({ unit_price: 115, tax_percentage: 15, tax_method: " Inc " }),
      item({ unit_price: 0.35, tax_percentage: 10 }),
    ]) {
      const r = totals([row]);
      expect(r.subtotal).toBe(backendTotalsFrom(r.discountedItems, 0).subtotal);
      expect(r.total).toBe(row.line_total);
    }
  });
});
describe("promotion selection", () => {
  const rows = [
    item({ variant_id: 1, quantity: 2 }),
    item({ variant_id: 2, quantity: 3 }),
    item({ variant_id: 3, quantity: 1 }),
  ];
  function select(
    results: Record<number, Partial<PromotionValidationResponse>>,
    selectedItems = rows,
    order = Object.keys(results).map(Number),
  ) {
    return totals(selectedItems, {
      appliedPromotions: order.map((id) =>
        promotion({ id, name: `Offer ${id}` }),
      ),
      evaluatePromotionFn: (p) => ({
        promotion_id: p.id,
        is_eligible: true,
        ...results[p.id],
      }),
    });
  }
  it("[CO-TOT-020] larger per-line discount wins", () =>
    expect(
      select({
        1: { discount_amount: 10, matched_variant_ids: [1] },
        2: { discount_amount: 15, matched_variant_ids: [1] },
      }).discountBreakdownByVariant[1].appliedPromotionId,
    ).toBe(2));
  it("[CO-TOT-021] equal per-line discount prefers more matched variants", () =>
    expect(
      select({
        1: { discount_amount: 25, matched_variant_ids: [1, 2] },
        2: { discount_amount: 10, matched_variant_ids: [1] },
      }).discountBreakdownByVariant[1].appliedPromotionId,
    ).toBe(1));
  it("[CO-TOT-022] equal discount/count prefers greater matched total quantity", () =>
    expect(
      select({
        1: { discount_amount: 25, matched_variant_ids: [1, 2] },
        2: { discount_amount: 15, matched_variant_ids: [1, 3] },
      }).discountBreakdownByVariant[1].appliedPromotionId,
    ).toBe(1));
  it("[CO-TOT-023] matched item quantity is identical for competing choices on one variant (characterization: unreachable tie tier)", () => {
    const r = select({
      1: { discount_amount: 10, matched_variant_ids: [1] },
      2: { discount_amount: 10, matched_variant_ids: [1] },
    });
    expect(
      r.discountBreakdownByVariant[1].appliedPromotionMatchedQuantity,
    ).toBe(2);
  });
  it("[CO-TOT-024] final tie prefers lower promotion id in either order", () => {
    const results = {
      1: { discount_amount: 10, matched_variant_ids: [1] },
      2: { discount_amount: 10, matched_variant_ids: [1] },
    };
    expect(
      select(results, rows, [2, 1]).discountBreakdownByVariant[1]
        .appliedPromotionId,
    ).toBe(1);
    expect(
      select(results, rows, [1, 2]).discountBreakdownByVariant[1]
        .appliedPromotionId,
    ).toBe(1);
  });
  it("[CO-TOT-025] ineligible, unmatched and zero discounts are ignored", () => {
    const r = select({
      1: {
        is_eligible: false,
        discount_amount: 1000,
        matched_variant_ids: [1],
      },
      2: { discount_amount: 0, matched_variant_ids: [1] },
      3: { discount_amount: 10, matched_variant_ids: [] },
      4: { matched_variant_ids: undefined },
    });
    expect(r.promotionDiscount).toBe(0);
    expect(r.discountedItems[0].applied_promotion_id).toBeUndefined();
  });
  it("[CO-TOT-026] one promotion is distributed proportionally across matched lines", () => {
    const r = select({
      1: { discount_amount: 50, matched_variant_ids: [1, 2] },
    });
    expect(
      r.discountedItems.map((row) => row.promotion_discount_amount),
    ).toEqual([20, 30, 0]);
    expect(r.promotionDiscount).toBe(50);
  });
  it("[CO-TOT-027] disjoint variants choose independent promotions", () =>
    expect(
      select({
        1: { discount_amount: 10, matched_variant_ids: [1] },
        2: { discount_amount: 20, matched_variant_ids: [2] },
      }).promotionDiscount,
    ).toBe(30));
  it("[CO-TOT-028] fixed-seed permutations preserve selection and totals", () => {
    const results = {
      1: { discount_amount: 10, matched_variant_ids: [1] },
      2: { discount_amount: 10, matched_variant_ids: [1] },
      3: { discount_amount: 20, matched_variant_ids: [2] },
    };
    const expected = select(results);
    fc.assert(
      fc.property(
        fc.shuffledSubarray([1, 2, 3], { minLength: 3, maxLength: 3 }),
        (order) => {
          expect(select(results, rows, order)).toEqual(expected);
        },
      ),
      options,
    );
  });
});
describe("sale total properties", () => {
  it("[CO-TOT-P01] sale equation conserves value", () =>
    fc.assert(
      fc.property(scenario, (s) => {
        const r = run(s);
        return (
          r.total ===
          round(r.subtotal - r.finalDiscount + r.totalTax + r.shippingCost)
        );
      }),
      options,
    ));
  it("[CO-TOT-P02] final discount is the sum of its components", () =>
    fc.assert(
      fc.property(scenario, (s) => {
        const r = run(s);
        return (
          r.finalDiscount ===
          round(r.promotionDiscount + r.averageDiscount + r.specialDiscount)
        );
      }),
      options,
    ));
  it("[CO-TOT-P03] average allocations equal the actual total discount", () =>
    fc.assert(
      fc.property(scenario, (s) => {
        const r = run(s);
        return (
          round(
            r.discountedItems.reduce(
              (sum, row) => sum + (row.average_discount_amount ?? 0),
              0,
            ),
          ) === r.averageDiscount
        );
      }),
      options,
    ));
  it("[CO-TOT-P04] all output amounts have at most two decimals", () =>
    fc.assert(
      fc.property(scenario, (s) => {
        const r = run(s);
        const money = [
          r.subtotal,
          r.totalTax,
          r.finalDiscount,
          r.averageDiscount,
          r.specialDiscount,
          r.promotionDiscount,
          r.shippingCost,
          r.total,
          ...r.discountedItems.flatMap((row) => [
            row.line_total,
            row.sold_unit_price ?? 0,
            row.average_discount_amount ?? 0,
            row.special_discount_amount ?? 0,
            row.promotion_discount_amount ?? 0,
          ]),
          ...Object.values(r.discountBreakdownByVariant).flatMap((b) => [
            b.average,
            b.special,
            b.promotion,
            b.total,
          ]),
        ];
        return money.every(
          (n) =>
            Number.isFinite(n) &&
            Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
        );
      }),
      options,
    ));
  it("[CO-TOT-P05] DTO line reconstruction equals every backend total", () =>
    fc.assert(
      fc.property(scenario, (s) => {
        const r = run(s);
        const backend = backendTotalsFrom(r.discountedItems, r.shippingCost);
        expect(backend.subtotal).toBeCloseTo(r.subtotal, 2);
        expect(backend.tax).toBeCloseTo(r.totalTax, 2);
        expect(backend.discount).toBeCloseTo(r.finalDiscount, 2);
        expect(backend.total).toBeCloseTo(r.total, 2);
      }),
      options,
    ));
  it("[CO-TOT-P06] without discounts/shipping, gross lines equal sale total", () =>
    fc.assert(
      fc.property(cart, (rows) => {
        const clean = rows.map((row) => ({
          ...row,
          special_discount_amount: 0,
        }));
        return (
          totals(clean).total ===
          round(clean.reduce((sum, row) => sum + row.line_total, 0))
        );
      }),
      options,
    ));
  it("[CO-TOT-P07] adding items increases subtotal and quantity increases tax", () =>
    fc.assert(
      fc.property(cart, (rows) => {
        const before = totals(rows);
        const added = item({ variant_id: rows.length + 1 });
        const first = rows[0];
        const increased = item({
          ...first,
          quantity: first.quantity + 1,
          line_total: undefined,
          tax_amount: undefined,
        });
        return (
          totals([...rows, added]).subtotal >= before.subtotal &&
          (increased.tax_amount ?? 0) >= (first.tax_amount ?? 0)
        );
      }),
      options,
    ));
  it("[CO-TOT-030] excessive combined discounts never create negative totals or net lines", () =>
    fc.assert(
      fc.property(cart, (rows) => {
        const excessive = rows.map((row) => ({
          ...row,
          special_discount_amount: 2 * row.line_total,
        }));
        const r = totals(excessive, {
          averageDiscountAmount: 100,
          averageDiscountType: DiscountType.PERCENTAGE,
        });
        return (
          r.total >= 0 && r.discountedItems.every((row) => row.line_total >= 0)
        );
      }),
      options,
    ));
});

it("[CO-TOT-033] unused capacity is redistributed after a line reaches its cap", () => {
  const r = totals(
    [
      item(),
      item({ variant_id: 2, unit_price: 900, special_discount_amount: 899 }),
    ],
    { averageDiscountAmount: 50 },
  );
  expect(r.discountedItems.map((row) => row.average_discount_amount)).toEqual([
    49, 1,
  ]);
  expect(r.averageDiscount).toBe(50);
  expect(r.total).toBe(51);
});
it("[CO-TOT-034] zero quantity/base lines remain zero and never absorb discounts", () => {
  const rows = [
    item({ quantity: 0, tax_percentage: undefined }),
    item({ variant_id: 2, unit_price: 0 }),
    item({ variant_id: 3 }),
  ];
  const r = totals(rows, {
    averageDiscountAmount: 10,
    appliedPromotions: [promotion()],
    evaluatePromotionFn: () => ({
      promotion_id: 1,
      is_eligible: true,
      discount_amount: 10,
      matched_variant_ids: [1, 2, 3],
    }),
  });
  expect(r.discountedItems.slice(0, 2).map((row) => row.line_total)).toEqual([
    0, 0,
  ]);
  expect(r.discountedItems[2]).toMatchObject({
    promotion_discount_amount: 10,
    average_discount_amount: 10,
    line_total: 80,
  });
  expect(totals([], { averageDiscountAmount: 10 }).total).toBe(0);
});
it("[CO-TOT-035] excessive negative requested discounts normalize to zero", () => {
  expect(
    totals([item({ special_discount_amount: -10 })], {
      averageDiscountAmount: -10,
    }),
  ).toMatchObject({ specialDiscount: 0, averageDiscount: 0, total: 100 });
});
