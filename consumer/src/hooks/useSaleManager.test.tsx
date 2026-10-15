import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { endpoints } from "../api/endpoints";
import { PriceType } from "../types/sale.types";
import { item, variant } from "../test/builders";
import { API, ok } from "../test/msw/api";
import { server } from "../test/msw/server";
import { testQueryClient } from "../test/query-clients";
import { useSaleManager } from "./useSaleManager";

const wrapper = () => {
  const client = testQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};
const user = {
  branches: [
    { id: 7, name: "Main" },
    { id: 8, name: "Other" },
  ],
};

describe("useSaleManager", () => {
  it("[CO-HOOK-001] picks the user's first branch and seeds the form", async () => {
    const form = { setFieldsValue: vi.fn() };
    const { result } = renderHook(() => useSaleManager({ form, user }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.selectedBranch).toBe(7));
    expect(form.setFieldsValue).toHaveBeenCalledWith({
      branch_id: 7,
      price_type: PriceType.REGULAR,
      average_discount_amount: undefined,
      shipping_cost: undefined,
    });
    expect(result.current.userBranches).toHaveLength(2);
  });

  it("[CO-HOOK-001] loads customers, staff and sellable products for the branch", async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}${endpoints.getCustomers}`, () =>
        ok({ data: [{ id: 1, name: "Ann" }] }),
      ),
      http.get(`${API}${endpoints.user}`, ({ request }) => {
        seen.push(new URL(request.url).searchParams.get("branch_id") ?? "");
        return ok({ data: [{ id: 3, name: "Cashier" }] });
      }),
      http.get(`${API}${endpoints.getProductsForSale}`, () =>
        ok([variant({ id: 5 })]),
      ),
      http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
    );
    const { result } = renderHook(
      () => useSaleManager({ form: { setFieldsValue: vi.fn() }, user }),
      { wrapper: wrapper() },
    );
    await waitFor(() =>
      expect(result.current.customers).toEqual([{ id: 1, name: "Ann" }]),
    );
    await waitFor(() =>
      expect(result.current.servedByUsers).toEqual([
        { id: 3, name: "Cashier" },
      ]),
    );
    await waitFor(() =>
      expect(result.current.filteredVariants.map((v) => v.id)).toEqual([5]),
    );
    expect(seen).toContain("7");
  });

  it("[CO-HOOK-001] a user with no branches loads no branch data", async () => {
    const { result } = renderHook(
      () => useSaleManager({ form: { setFieldsValue: vi.fn() }, user: null }),
      { wrapper: wrapper() },
    );
    expect(result.current.selectedBranch).toBeNull();
    expect(result.current.servedByUsersQuery.fetchStatus).toBe("idle");
    expect(result.current.productsForSaleQuery.fetchStatus).toBe("idle");
  });

  it("[CO-HOOK-001] changing branch empties the cart and resets discount state", async () => {
    server.use(
      http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
      http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
      http.get(`${API}${endpoints.getProductsForSale}`, () => ok([])),
      http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
    );
    const form = { setFieldsValue: vi.fn() };
    const { result } = renderHook(() => useSaleManager({ form, user }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.selectedBranch).toBe(7));
    act(() => {
      result.current.setSelectedItems([item()]);
      result.current.setProductSearch("shirt");
    });
    act(() => result.current.handleBranchChange(8));
    expect(result.current.selectedBranch).toBe(8);
    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.productSearch).toBe("");
    expect(form.setFieldsValue).toHaveBeenLastCalledWith({
      branch_id: 8,
      average_discount_amount: undefined,
    });
  });

  it("[CO-HOOK-001] keeps the chosen customer in the list even when search results omit them", async () => {
    server.use(
      http.get(`${API}${endpoints.getCustomers}`, () =>
        ok({ data: [{ id: 1, name: "Ann" }] }),
      ),
      http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
      http.get(`${API}${endpoints.getProductsForSale}`, () => ok([])),
      http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
    );
    const { result } = renderHook(
      () => useSaleManager({ form: { setFieldsValue: vi.fn() }, user }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.customers).toHaveLength(1));
    act(() =>
      result.current.setSelectedCustomer({ id: 99, name: "Walk-in" } as any),
    );
    await waitFor(() =>
      expect(result.current.customers.map((c) => c.id)).toEqual([99, 1]),
    );
  });
});
