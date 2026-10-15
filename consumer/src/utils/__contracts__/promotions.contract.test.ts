import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { item, promotion } from "../../test/builders";
import { evaluatePromotionLocally } from "../promotion-validation";

// Shared with backend/test/integration/contracts/promotions.contract.int-spec.ts.
// Both sides map the neutral fixture to their own types and must produce the same result.
const dir = resolve(__dirname, "../../../../contracts/fixtures");
const reasonCodes: { code: string; pattern: string }[] = JSON.parse(
  readFileSync(resolve(dir, "promotion-reason-codes.json"), "utf8"),
);
const reasonCode = (message?: string) =>
  reasonCodes.find((r) => new RegExp(r.pattern).test(message ?? ""))?.code ??
  `UNMAPPED:${message}`;

const VARIANT_ID: Record<string, number> = { P1: 1, P2: 2, P3: 3 };
const BRAND_ID: Record<string, number> = { B1: 10, B2: 20 };
const BRANCH_ID: Record<string, number> = { main: 1, other: 2 };
const keyOf = (id: number) =>
  Object.keys(VARIANT_ID).find((k) => VARIANT_ID[k] === id);

type Expected = {
  eligible: boolean;
  reason_code?: string;
  discount_amount?: number;
  matched?: string[];
};
type Case = {
  id: string;
  promotion: Record<string, any>;
  branch: string;
  customer: boolean;
  cart: { variant: string; qty: number; price: number }[];
  expected?: Expected;
  expected_frontend?: Expected;
};
type FixtureFile = {
  defaults: {
    now: string;
    variants: Record<string, { brand: string }>;
    promotion: Record<string, any>;
  };
  cases: Case[];
};

const files = readdirSync(resolve(dir, "promotions")).filter((f) =>
  f.endsWith(".json"),
);

for (const file of files) {
  describe(`shared promotion fixtures: ${file}`, () => {
    const fixture: FixtureFile = JSON.parse(
      readFileSync(resolve(dir, "promotions", file), "utf8"),
    );
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(fixture.defaults.now));
    });
    afterEach(() => vi.useRealTimers());

    it.each(fixture.cases.map((c) => [c.id, c] as const))(
      "[%s] consumer evaluation matches the contract",
      (_id, c) => {
        const p = { ...fixture.defaults.promotion, ...c.promotion };
        const variantIds = (p.products as string[]).map((k) => VARIANT_ID[k]);
        const model = promotion({
          id: 7,
          scope: p.scope,
          discount_type: p.discount_type,
          discount_value: p.discount_value,
          is_active: p.is_active,
          start_date: p.start_date,
          end_date: p.end_date ?? undefined,
          branch_specific: p.branch_specific,
          branch_ids: (p.branches as string[]).map((b) => BRANCH_ID[b]),
          variant_ids: variantIds,
          brand_id: p.brand ? BRAND_ID[p.brand] : undefined,
          min_purchase: p.min_purchase ?? undefined,
          min_quantity: p.min_quantity ?? undefined,
          cap_quantity: p.cap_quantity ?? undefined,
          cap_discount_amount: p.cap_discount_amount ?? undefined,
          max_discount_amount: p.max_discount_amount ?? undefined,
          usage_limit: p.usage_limit ?? undefined,
          member_only: p.member_only,
          limit_per_customer: p.limit_per_customer,
          customer_usage_limit: p.customer_usage_limit ?? undefined,
          sales_count: p.sales_count,
          total_discount_given: p.total_discount_given,
        });
        const result = evaluatePromotionLocally({
          promotion: model,
          items: c.cart.map((l) =>
            item({
              variant_id: VARIANT_ID[l.variant],
              unit_price: l.price,
              quantity: l.qty,
            }),
          ),
          branchId: BRANCH_ID[c.branch],
          customerId: c.customer ? 99 : undefined,
          variantBrandById: Object.fromEntries(
            Object.entries(fixture.defaults.variants).map(([k, v]) => [
              VARIANT_ID[k],
              BRAND_ID[v.brand],
            ]),
          ),
        });
        const expected = c.expected_frontend ?? c.expected!;
        expect(result.is_eligible).toBe(expected.eligible);
        if (expected.eligible) {
          expect(result.discount_amount).toBe(expected.discount_amount);
          expect(result.matched_variant_ids?.map((id) => keyOf(id))).toEqual(
            expected.matched,
          );
        } else {
          expect(reasonCode(result.reason)).toBe(expected.reason_code);
        }
      },
    );
  });
}
