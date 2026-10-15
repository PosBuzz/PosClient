import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { item, promotion } from "../../test/builders";
import { DiscountType } from "../../types/sale.types";
import { calculateSaleTotals } from "../calculate-totals.utils";
import { evaluatePromotionLocally } from "../promotion-validation";
import { toSalePayloadItems } from "../sale-payload.utils";

// X-TOT-*: hand-written fixtures. X-TOT-R01: the consumer generates, the backend replays
// (backend/test/integration/contracts/sale-totals.contract.int-spec.ts). Regenerate with
// `UPDATE_CONTRACTS=1 npm test -- sale-totals.contract`.
const root = resolve(__dirname, "../../../../contracts");
const NOW = "2026-03-14T10:00:00.000Z";
const promoDefaults = JSON.parse(
  readFileSync(resolve(root, "fixtures/promotions/eligibility.json"), "utf8"),
).defaults.promotion as Record<string, any>;

type Variant = { key: string; price: number; taxPct: number; method: string };
type Definition = {
  id: string;
  description: string;
  variants: Variant[];
  lines: { variant: string; qty: number }[];
  averageDiscount: { type: "FLAT" | "PERCENTAGE"; amount: number };
  specialDiscounts: Record<string, number>;
  shipping: number;
  promotions: Record<string, any>[];
  expected?: Record<string, string>;
};

const money = (n: number) => n.toFixed(2);

function compute(def: Definition) {
  const ids = Object.fromEntries(def.variants.map((v, i) => [v.key, i + 1]));
  const byKey = Object.fromEntries(def.variants.map((v) => [v.key, v]));
  const promos: Record<string, any>[] = def.promotions.map((p) => {
    const merged: Record<string, any> = { ...promoDefaults, ...p };
    return {
      ...merged,
      variant_ids: (merged.products as string[]).map((k) => ids[k]),
    };
  });
  const items = def.lines.map((line) => {
    const v = byKey[line.variant];
    return item({
      variant_id: ids[line.variant],
      unit_price: v.price,
      regular_price: v.price,
      quantity: line.qty,
      tax_percentage: v.taxPct,
      tax_method: v.method,
      special_discount_amount: def.specialDiscounts[line.variant] ?? 0,
    });
  });
  const appliedPromotions = promos.map((p) =>
    promotion({
      id: p.id,
      scope: p.scope,
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      is_active: p.is_active,
      start_date: p.start_date,
      end_date: p.end_date ?? undefined,
      variant_ids: p.variant_ids,
      min_quantity: p.min_quantity ?? undefined,
      cap_quantity: p.cap_quantity ?? undefined,
    }),
  );
  const totals = calculateSaleTotals({
    selectedItems: items,
    averageDiscountAmount: def.averageDiscount.amount,
    averageDiscountType:
      def.averageDiscount.type === "FLAT"
        ? DiscountType.FLAT
        : DiscountType.PERCENTAGE,
    shippingCost: def.shipping,
    appliedPromotions,
    evaluatePromotionFn: (p, cart) =>
      evaluatePromotionLocally({
        promotion: p,
        items: cart,
        branchId: 1,
        variantBrandById: {},
      }),
  });
  return {
    id: def.id,
    variants: def.variants.map((v, i) => ({
      id: i + 1,
      price: v.price,
      taxPct: v.taxPct,
      method: v.method,
    })),
    promotions: promos,
    payload: {
      items: toSalePayloadItems(totals.discountedItems),
      shipping_cost: totals.shippingCost,
    },
    expected: {
      subtotal: money(totals.subtotal),
      tax_amount: money(totals.totalTax),
      discount_amount: money(totals.finalDiscount),
      total_amount: money(totals.total),
    },
  };
}

const fixtureDir = resolve(root, "fixtures/sale-totals");
const definitions: Definition[] = readdirSync(fixtureDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(fixtureDir, f), "utf8")));

const cents = (min: number, max: number) =>
  fc.integer({ min, max }).map((n) => n / 100);
const cartArb = fc
  .array(
    fc.record({
      price: cents(1, 100000),
      qty: fc.integer({ min: 1, max: 20 }),
      // Product.tax is an integer percentage column in the catalog.
      taxPct: fc.integer({ min: 0, max: 25 }),
      method: fc.constantFrom("EXCLUSIVE", "INCLUSIVE"),
      specialPct: fc.integer({ min: 0, max: 100 }),
    }),
    { minLength: 1, maxLength: 5 },
  )
  .chain((lines) =>
    fc.record({
      lines: fc.constant(lines),
      averageType: fc.constantFrom<"FLAT" | "PERCENTAGE">("FLAT", "PERCENTAGE"),
      averagePct: fc.integer({ min: 0, max: 100 }),
      shipping: cents(0, 10000),
    }),
  );
const randomDefinitions: Definition[] = fc
  .sample(cartArb, { seed: 20261012, numRuns: 200 })
  .map((cart, index) => {
    const variants = cart.lines.map((l, i) => ({
      key: `V${i + 1}`,
      price: l.price,
      taxPct: l.taxPct,
      method: l.method,
    }));
    const base = cart.lines.reduce((s, l) => s + l.price * l.qty, 0);
    const amount =
      cart.averageType === "PERCENTAGE"
        ? cart.averagePct
        : Number(((base * cart.averagePct) / 100).toFixed(2));
    return {
      id: `X-TOT-RANDOM-${String(index + 1).padStart(3, "0")}`,
      description: "generated cart",
      variants,
      lines: cart.lines.map((l, i) => ({ variant: `V${i + 1}`, qty: l.qty })),
      averageDiscount: { type: cart.averageType, amount },
      specialDiscounts: Object.fromEntries(
        cart.lines.map((l, i) => [
          `V${i + 1}`,
          Number(((l.price * l.qty * l.specialPct) / 100).toFixed(2)),
        ]),
      ),
      shipping: cart.shipping,
      promotions: [],
    };
  });

const update = process.env.UPDATE_CONTRACTS === "1";
const read = (name: string) =>
  JSON.parse(readFileSync(resolve(root, "generated", name), "utf8"));
const write = (name: string, data: unknown) =>
  writeFileSync(
    resolve(root, "generated", name),
    `${JSON.stringify(data, null, 2)}\n`,
  );

describe("sale totals contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => vi.useRealTimers());

  it.each(definitions.map((d) => [d.id, d] as const))(
    "[%s] consumer totals match the hand-written fixture",
    (_id, def) => {
      expect(compute(def).expected).toEqual(def.expected);
    },
  );

  it("[X-TOT-R00] fixture payloads are published for the backend replay", () => {
    const generated = definitions.map(compute);
    if (update) {
      write("sale-totals-fixtures.json", generated);
    }
    expect(read("sale-totals-fixtures.json")).toEqual(generated);
  });

  it("[X-TOT-R01] regenerated random carts equal the committed file", () => {
    const generated = randomDefinitions.map(compute);
    if (update) {
      write("sale-totals-random.json", generated);
    }
    expect(read("sale-totals-random.json")).toEqual(generated);
  });
});
