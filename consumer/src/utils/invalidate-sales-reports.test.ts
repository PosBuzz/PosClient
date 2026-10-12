import { QueryClient } from "@tanstack/react-query";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../constants/queryKeys";
import { invalidateSalesReports } from "./invalidate-sales-reports";

describe("invalidateSalesReports", () => {
  it("[CO-CACHE-001] invalidates every roll-up that is computed from sales and returns, and nothing else", () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    invalidateSalesReports(client);
    expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      [queryKeys.sales],
      [queryKeys.sale],
      [queryKeys.salesStats],
      [queryKeys.dashboardAnalytics],
      [queryKeys.eod],
      [queryKeys.dailyTarget],
      [queryKeys.userSalesStats],
      [queryKeys.variantSalesStats],
    ]);
  });

  it("[CO-CACHE-001] marks cached report data stale so the next visit refetches", async () => {
    const client = new QueryClient();
    for (const key of [
      queryKeys.dashboardAnalytics,
      queryKeys.eod,
      queryKeys.sales,
    ]) {
      client.setQueryData([key, "today"], { total: 1 });
    }
    client.setQueryData([queryKeys.products, "list"], { untouched: true });
    invalidateSalesReports(client);
    expect(
      client.getQueryState([queryKeys.dashboardAnalytics, "today"])
        ?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryState([queryKeys.eod, "today"])?.isInvalidated).toBe(
      true,
    );
    expect(
      client.getQueryState([queryKeys.products, "list"])?.isInvalidated,
    ).toBe(false);
  });
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe("every screen that changes a sale refreshes the reports", () => {
  const src = resolve(__dirname, "..");
  // Calls that create, remove, restore, refund or settle a sale
  const CHANGES_SALES =
    /salesApi\.(createSale|deleteSale|restoreSale|completePendingDelivery|cancelPendingDelivery|updateOnlineOrderStatus)\b|returnsApi\.createReturn\b|paymentsApi\.makePayment\b/;
  const files = walk(src)
    .filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.includes("/api/"),
    )
    .map((f) => ({
      file: f.slice(src.length + 1),
      text: readFileSync(f, "utf8"),
    }));

  it("[CO-CACHE-002] each file that calls them also calls invalidateSalesReports", () => {
    const changers = files.filter(({ text }) => CHANGES_SALES.test(text));
    expect(changers.map((f) => f.file).sort()).toEqual(
      [
        "pages/add-sales/index.tsx",
        "pages/partial-payments/make-payment.tsx",
        "pages/online-orders/index.tsx",
        "pages/pending-deliveries/index.tsx",
        "pages/pos/index.tsx",
        "pages/returns/create.tsx",
        "pages/sales/index.tsx",
      ].sort(),
    );
    expect(
      changers
        .filter(({ text }) => !text.includes("invalidateSalesReports"))
        .map((f) => f.file),
    ).toEqual([]);
  });
});
