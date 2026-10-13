import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { item, variant } from "../test/builders";
import { PriceType } from "../types/sale.types";
import {
  calculateTaxAndTotal as calc,
  getVariantPriceForSale,
  upsertVariantInSaleItems,
  updateSaleItemQuantity,
  removeSaleItem,
  repriceSaleItems,
  updateSaleItemSpecialDiscount,
} from "./sale-item.utils";
const options = { seed: 424242, numRuns: 500 };
const price = fc.integer({ min: 0, max: 10000000 }).map((n) => n / 100);
const qty = fc.integer({ min: 0, max: 50 });
const tax = fc.integer({ min: 0, max: 2500 }).map((n) => n / 100);
const round = (n: number) => Number(n.toFixed(2));
const cents = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
it("[CO-SALE-MAP-001] API Decimal strings and null images become numeric cart values and an absent image", () => {
  const rows = upsertVariantInSaleItems({
    sourceItems: [],
    variant: variant({ regular_price: "100", image: null, tax_percentage: 5 }),
    quantityToAdd: 1,
    priceType: PriceType.REGULAR,
  });
  expect(rows[0]).toMatchObject({
    unit_price: 100,
    line_total: 105,
    tax_amount: 5,
    image: undefined,
  });
});
it("[CO-SALE-PER-QTY-001] adding a unit preserves an opted-in per-unit discount and handles zero discount", () => {
  const v = variant();
  for (const [quantity, discount, expected] of [
    [2, 10, 15],
    [0, 0, 0],
  ]) {
    const result = upsertVariantInSaleItems({
      sourceItems: [
        item({ variant_id: v.id, quantity, special_discount_amount: discount }),
      ],
      variant: v,
      quantityToAdd: 1,
      priceType: PriceType.REGULAR,
      specialDiscountPerQuantity: true,
    });
    expect(result[0].special_discount_amount).toBe(expected);
  }
});
it("[CO-SALE-REPRICE-002] a zero-priced variant with absent tax metadata stays a zero total", () => {
  const zero = variant({
    regular_price: 0,
    wholesale_price: 0,
    tax_percentage: undefined,
    tax_method: undefined,
  });
  const source = item({ variant_id: zero.id, quantity: 2, unit_price: 99 });
  expect(
    repriceSaleItems({
      sourceItems: [source],
      variants: [zero],
      priceType: PriceType.REGULAR,
    })[0],
  ).toMatchObject({ unit_price: 0, line_total: 0, tax_amount: 0 });
});
describe("line tax", () => {
  it.each([
    ["CO-CALC-001", 100, 2, 0, "EXCLUSIVE", 200, 0, 200],
    ["CO-CALC-002", 100, 2, 5, "EXCLUSIVE", 210, 10, 200],
    ["CO-CALC-003", 115, 1, 15, "INCLUSIVE", 115, 15, 100],
    ["CO-CALC-004", 100, 3, 7.5, "INCLUSIVE", 300, 20.93, 279.07],
    ["CO-CALC-008", 0.1, 3, 0, "EXCLUSIVE", 0.3, 0, 0.3],
    ["CO-CALC-009", 33.333, 3, 0, "EXCLUSIVE", 100, 0, 100],
  ] as const)(
    "[%s] computes tax/total",
    (_id, p, q, t, method, line, taxableTax, base) =>
      expect(calc(p, q, t, method), _id).toEqual({
        line_total: line,
        tax_amount: taxableTax,
        taxable_amount: base,
      }),
  );
  it("[CO-CALC-005] inclusive aliases are normalized", () => {
    for (const method of ["inclusive", " Inc ", "INC"]) {
      expect(calc(115, 1, 15, method)).toEqual({
        line_total: 115,
        tax_amount: 15,
        taxable_amount: 100,
      });
    }
  });
  it("[CO-CALC-006] missing/unknown methods use exclusive tax", () => {
    for (const method of ["", undefined, "foo"]) {
      expect(calc(100, 1, 10, method as string)).toEqual({
        line_total: 110,
        tax_amount: 10,
        taxable_amount: 100,
      });
    }
  });
  it("[CO-CALC-007] invalid/missing tax is zero", () => {
    for (const value of [NaN, undefined, "abc"]) {
      expect(calc(100, 1, value as number, "EXCLUSIVE")).toEqual({
        line_total: 100,
        tax_amount: 0,
        taxable_amount: 100,
      });
    }
  });
  it("[CO-CALC-P01] exclusive tax plus base conserves the line within rounding", () =>
    fc.assert(
      fc.property(price, qty, tax, (p, q, t) => {
        const r = calc(p, q, t, "EXCLUSIVE");
        return (
          Math.abs(r.line_total - r.taxable_amount - r.tax_amount) <= 0.011
        );
      }),
      options,
    ));
  it("[CO-CALC-P02] inclusive gross equals price times quantity", () =>
    fc.assert(
      fc.property(price, qty, tax, (p, q, t) => {
        const r = calc(p, q, t, "INCLUSIVE");
        return r.line_total === round(p * q) && r.tax_amount <= r.line_total;
      }),
      options,
    ));
  it("[CO-CALC-P03] all money outputs are nonnegative integer cents", () =>
    fc.assert(
      fc.property(
        price,
        qty,
        tax,
        fc.constantFrom("EXCLUSIVE", "INCLUSIVE"),
        (p, q, t, m) =>
          Object.values(calc(p, q, t, m)).every((n) => n >= 0 && cents(n)),
      ),
      options,
    ));
  it("[CO-CALC-P04] tax is monotonic in tax percentage", () =>
    fc.assert(
      fc.property(
        price,
        qty,
        tax,
        tax,
        fc.constantFrom("EXCLUSIVE", "INCLUSIVE"),
        (p, q, a, b, m) =>
          calc(p, q, Math.min(a, b), m).tax_amount <=
          calc(p, q, Math.max(a, b), m).tax_amount,
      ),
      options,
    ));
});
describe("cart mutations", () => {
  it("[CO-CART-001] wholesale falls back to regular when missing or zero", () => {
    expect(getVariantPriceForSale(variant(), PriceType.REGULAR)).toBe(100);
    expect(getVariantPriceForSale(variant(), PriceType.WHOLESALE)).toBe(80);
    for (const value of [0, undefined, null]) {
      expect(
        getVariantPriceForSale(
          variant({ wholesale_price: value as number }),
          PriceType.WHOLESALE,
        ),
      ).toBe(100);
    }
  });
  it("[CO-CART-002] new variant carries display fields and computed tax", () => {
    const v = variant({ image: "image.png", tax_percentage: 5 });
    const rows = upsertVariantInSaleItems({
      sourceItems: [],
      variant: v,
      quantityToAdd: 2,
      priceType: PriceType.REGULAR,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        variant_id: v.id,
        variant_name: v.name,
        variant_sku: v.sku,
        product_name: v.product_name,
        image: v.image,
        unit_name: v.unit_name,
        quantity: 2,
        unit_price: 100,
        line_total: 210,
        tax_amount: 10,
        regular_price: 100,
        wholesale_price: 80,
      }),
    ]);
  });
  it("[CO-CART-003] existing variant re-reads current price type and leaves siblings alone", () => {
    const sibling = item({ variant_id: 2 });
    const rows = upsertVariantInSaleItems({
      sourceItems: [item(), sibling],
      variant: variant({ tax_percentage: 5 }),
      quantityToAdd: 2,
      priceType: PriceType.WHOLESALE,
    });
    expect(rows[0]).toMatchObject({
      quantity: 3,
      unit_price: 80,
      line_total: 252,
      tax_amount: 12,
    });
    expect(rows[1]).toBe(sibling);
  });
  it("[CO-CART-004] frozen inputs remain unchanged", () => {
    const row = Object.freeze(item());
    const rows = Object.freeze([row]);
    const v = Object.freeze(variant());
    expect(
      upsertVariantInSaleItems({
        sourceItems: rows as unknown as ReturnType<typeof item>[],
        variant: v,
        quantityToAdd: 1,
        priceType: PriceType.REGULAR,
      })[0].quantity,
    ).toBe(2);
    expect(row.quantity).toBe(1);
    expect(
      upsertVariantInSaleItems({
        sourceItems: [],
        variant: v,
        quantityToAdd: 1,
        priceType: PriceType.REGULAR,
      }),
    ).toHaveLength(1);
  });
  it("[CO-CART-005] quantity uses the item's own price and fallback tax method", () => {
    const row = item({
      unit_price: 115,
      tax_percentage: 15,
      tax_method: "INCLUSIVE",
    });
    const sibling = item({ variant_id: 2 });
    expect(
      updateSaleItemQuantity({
        sourceItems: [row, sibling],
        variantId: 1,
        quantity: 2,
        variants: [],
      })[0],
    ).toMatchObject({ line_total: 230, tax_amount: 30 });
    expect(
      updateSaleItemQuantity({
        sourceItems: [row],
        variantId: 1,
        quantity: 2,
        variants: [variant({ regular_price: 999, tax_method: "EXCLUSIVE" })],
      })[0],
    ).toMatchObject({ unit_price: 115, line_total: 264.5, tax_amount: 34.5 });
    expect(
      updateSaleItemQuantity({
        sourceItems: [
          item({ tax_method: undefined, tax_percentage: undefined }),
          sibling,
        ],
        variantId: 1,
        quantity: 2,
        variants: [variant({ tax_method: "" })],
      })[1],
    ).toBe(sibling);
  });
  it("[CO-CART-006] removes only the target variant", () => {
    const sibling = item({ variant_id: 2 });
    expect(removeSaleItem([item(), sibling], 1)).toEqual([sibling]);
  });
  it("[CO-CART-007] invalid special discounts normalize to zero without changing siblings", () => {
    const sibling = item({ variant_id: 2 });
    for (const amount of [-1, NaN]) {
      const rows = updateSaleItemSpecialDiscount([item(), sibling], 1, amount);
      expect(rows[0].special_discount_amount).toBe(0);
      expect(rows[1]).toBe(sibling);
    }
    expect(
      updateSaleItemSpecialDiscount([item()], 1, 10)[0].special_discount_amount,
    ).toBe(10);
  });
  it("[CO-CART-008] the edit helper retains the requested discount; totals enforce line capacity", () =>
    expect(
      updateSaleItemSpecialDiscount([item()], 1, 200)[0]
        .special_discount_amount,
    ).toBe(200));
  it("[CO-CART-009] absent display values retain zero/exclusive defaults", () => {
    expect(
      upsertVariantInSaleItems({
        sourceItems: [],
        variant: variant({
          regular_price: 0,
          wholesale_price: undefined,
          tax_percentage: 0,
          tax_method: "",
        }),
        quantityToAdd: 1,
        priceType: PriceType.REGULAR,
      })[0],
    ).toMatchObject({
      unit_price: 0,
      wholesale_price: 0,
      tax_method: "EXCLUSIVE",
      line_total: 0,
    });
  });
});

it("[CO-CART-010] existing items handle missing tax method and zero-price quantity changes", () => {
  expect(
    upsertVariantInSaleItems({
      sourceItems: [item()],
      variant: variant({ tax_method: "", tax_percentage: 0 }),
      quantityToAdd: 1,
      priceType: PriceType.REGULAR,
    })[0].line_total,
  ).toBe(200);
  expect(
    updateSaleItemQuantity({
      sourceItems: [item()],
      variantId: 1,
      quantity: 0,
      variants: [],
    })[0],
  ).toMatchObject({ line_total: 0, tax_amount: 0 });
});

it("[CO-SALE-REPRICE-001] switching price type re-prices every known line, keeps discounts, and leaves unknown lines alone", () => {
  const v1 = variant({
    id: 1,
    regular_price: 100,
    wholesale_price: 80,
    tax_percentage: 10,
  });
  const sourceItems = [
    item({
      variant_id: 1,
      unit_price: 100,
      quantity: 2,
      tax_percentage: 10,
      special_discount_amount: 5,
    }),
    item({ variant_id: 9, unit_price: 33, quantity: 1 }),
  ];
  const [one, unknown] = repriceSaleItems({
    sourceItems,
    variants: [v1],
    priceType: PriceType.WHOLESALE,
  });
  expect(one).toMatchObject({
    unit_price: 80,
    quantity: 2,
    special_discount_amount: 5,
    tax_amount: 16,
    line_total: 176,
  });
  expect(unknown).toBe(sourceItems[1]);
  expect(
    repriceSaleItems({
      sourceItems: [one],
      variants: [v1],
      priceType: PriceType.REGULAR,
    })[0].unit_price,
  ).toBe(100);
});
