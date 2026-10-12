import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import axiosInstance from "./api/axiosInstance";
import { queryClientOptions } from "./queryClientOptions";
import { server } from "./test/msw/server";
import { API } from "./test/msw/api";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = resolve(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const src = resolve(__dirname);
const withMutations = walk(src)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
  .filter((f) => /useMutation\s*[(<]/.test(readFileSync(f, "utf8")))
  .map((f) => f.slice(src.length + 1))
  .sort();

// Every file that creates a mutation. A new one must be added here on purpose: it has to be checked
// that it cannot silently resend a sale, return, payment or stock movement (KI-010).
const KNOWN_MUTATION_FILES = [
  "components/ImportModal.tsx",
  "components/VendorSelector.tsx",
  "pages/account-security/index.tsx",
  "pages/add-inventory-adjustment/index.tsx",
  "pages/add-or-edit-inventory/index.tsx",
  "pages/add-or-edit-product/components/AiDescriptionGenerator.tsx",
  "pages/add-or-edit-product/components/MasterDataSelector.tsx",
  "pages/add-or-edit-product/components/VendorSelector.tsx",
  "pages/add-or-edit-product/hooks/useProductSaveMutations.ts",
  "pages/add-or-edit-receipt-settings/index.tsx",
  "pages/branches/_DrawerForm.tsx",
  "pages/branches/_TableGrid.tsx",
  "pages/brands/_DrawerForm.tsx",
  "pages/brands/_TableGrid.tsx",
  "pages/categories/_DrawerForm.tsx",
  "pages/categories/_TableGrid.tsx",
  "pages/create-inventory-transfer/index.tsx",
  "pages/customers/_DrawerForm.tsx",
  "pages/customers/_TableGrid.tsx",
  "pages/inventory-transfers/index.tsx",
  "pages/inventory/index.tsx",
  "pages/operational-costs/index.tsx",
  "pages/partial-payments/make-payment.tsx",
  "pages/pending-deliveries/index.tsx",
  "pages/products/index.tsx",
  "pages/profile/index.tsx",
  "pages/promotions/_DrawerForm.tsx",
  "pages/promotions/_TableGrid.tsx",
  "pages/purchase-payments/make-payment.tsx",
  "pages/receipt-settings/index.tsx",
  "pages/returns/create.tsx",
  "pages/roles/_DrawerForm.tsx",
  "pages/roles/_TableGrid.tsx",
  "pages/sales/index.tsx",
  "pages/support/index.tsx",
  "pages/tags/_DrawerForm.tsx",
  "pages/tags/_TableGrid.tsx",
  "pages/units/_DrawerForm.tsx",
  "pages/units/_TableGrid.tsx",
  "pages/users/_DrawerForm.tsx",
  "pages/users/_TableGrid.tsx",
  "pages/vendors/_DrawerForm.tsx",
  "pages/vendors/_TableGrid.tsx",
  "pages/view-sale/index.tsx",
];

describe("query client defaults", () => {
  it("[CO-API-020] mutations never retry (KI-010)", () => {
    expect(queryClientOptions.defaultOptions?.mutations?.retry).toBe(0);
  });

  it("[CO-API-021] a failing POST through a real mutation is sent exactly once", async () => {
    let posts = 0;
    server.use(
      http.post(`${API}/consumer/returns`, () => {
        posts++;
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }),
    );
    const client = new QueryClient(queryClientOptions);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => axiosInstance.post("/consumer/returns", {}),
        }),
      { wrapper },
    );
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(posts).toBe(1);
    client.clear();
  });

  it("[CO-API-022] the set of files that define mutations is known, and none of them sets its own retry", () => {
    expect(withMutations).toEqual(KNOWN_MUTATION_FILES);
    const overridingRetry = withMutations.filter((f) =>
      /useMutation\s*[(<][^;]*?\bretry\s*:/s.test(
        readFileSync(resolve(src, f), "utf8"),
      ),
    );
    expect(overridingRetry).toEqual([]);
  });
});
