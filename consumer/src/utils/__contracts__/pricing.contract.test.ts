import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateTaxAndTotal } from "../sale-item.utils";
import { getSubdomain } from "../subdomain";
import { vi } from "vitest";

// Shared with backend/src/consumer/sales/utils/sale-pricing.util.contract.spec.ts
// and backend/src/common/services/subdomain-util.contract.spec.ts.
const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../../contracts/fixtures", name),
      "utf8",
    ),
  );

type PriceRow = {
  id: string;
  price: number;
  qty: number;
  taxPct: number;
  method: string;
  expected: { line_total: number; tax_amount: number };
};

describe("shared pricing fixtures", () => {
  it.each(fixture<PriceRow[]>("pricing.json").map((r) => [r.id, r] as const))(
    "[%s] consumer line math matches the contract",
    (_id, row) => {
      const out = calculateTaxAndTotal(
        row.price,
        row.qty,
        row.taxPct,
        row.method,
      );
      expect(out.line_total).toBe(row.expected.line_total);
      expect(out.tax_amount).toBe(row.expected.tax_amount);
    },
  );
});

describe("shared subdomain fixtures", () => {
  it.each(
    fixture<{ id: string; host: string; expected: string | null }[]>(
      "subdomains.json",
    ).map((r) => [r.id, r] as const),
  )("[%s] consumer host parsing matches the contract", (_id, row) => {
    vi.stubGlobal("window", { location: { hostname: row.host } });
    try {
      expect(getSubdomain()).toBe(row.expected);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
