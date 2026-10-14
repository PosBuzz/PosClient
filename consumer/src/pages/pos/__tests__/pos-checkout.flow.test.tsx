import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../../constants/queryKeys";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import {
  DiscountType,
  PriceType,
  type ProductVariantForSale,
  type SaleItem,
} from "../../../types/sale.types";
import { calculateSaleTotals } from "../../../utils/calculate-totals.utils";
import { toSalePayloadItems } from "../../../utils/sale-payload.utils";
import {
  updateSaleItemSpecialDiscount,
  upsertVariantInSaleItems,
} from "../../../utils/sale-item.utils";
import POS from "../index";

const variants = responseContract<ProductVariantForSale[]>("products-for-sale");
const byProduct = (name: string) =>
  variants.find((v) => v.product_name === name)!;
const P1 = "Product 5"; // id 1, 100 + 5% tax
const P2 = "Product 12"; // id 2, 250 tax inclusive 15%
const P3 = "Product 19"; // id 3, 40 no tax

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () => ok(variants)),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
});

const mount = () =>
  renderWithProviders(<POS />, { route: "/pos", path: "/pos" });

/** Opens the product search and clicks the row for `productName`. */
async function addProduct(user: UserEvent, productName: string) {
  const placeholder = await screen.findByText(/Search or scan barcode/);
  const select = placeholder.closest(".ant-select") as HTMLElement;
  const box = within(select).getByRole("combobox");
  await waitFor(() => expect(box).toBeEnabled());
  await user.click(box);
  const rows = await screen.findAllByText(productName);
  await user.click(rows[rows.length - 1]);
}
const cartRow = (productName: string) =>
  screen
    .queryAllByRole("row")
    .find(
      (row) =>
        row.textContent?.includes(productName) &&
        within(row).queryAllByRole("spinbutton").length > 0,
    ) as HTMLElement | undefined;
const totalOnScreen = () => screen.getByTestId("pos-total").textContent;
const complete = (user: UserEvent) =>
  user.click(screen.getByRole("button", { name: /Complete Sale/ }));
// Replaces the field's text (select-all, then type), as a cashier overtyping the amount
const setNumber = async (
  user: UserEvent,
  input: HTMLElement,
  value: string,
) => {
  const field = input as HTMLInputElement;
  await user.type(field, value, {
    initialSelectionStart: 0,
    initialSelectionEnd: field.value.length,
  });
};

/** What the screen should total, computed from the same pure functions the page uses. */
function expectedCart(
  lines: Array<{
    product: string;
    qty: number;
    special?: number;
  }>,
  extra: {
    averageDiscountAmount?: number;
    averageDiscountType?: DiscountType;
    priceType?: PriceType;
    variantList?: ProductVariantForSale[];
  } = {},
) {
  let items: SaleItem[] = [];
  for (const line of lines) {
    const variant = (extra.variantList ?? variants).find(
      (v) => v.product_name === line.product,
    )!;
    items = upsertVariantInSaleItems({
      sourceItems: items,
      variant,
      quantityToAdd: line.qty,
      priceType: extra.priceType ?? PriceType.REGULAR,
    });
    if (line.special) {
      items = updateSaleItemSpecialDiscount(items, variant.id, line.special);
    }
  }
  const totals = calculateSaleTotals({
    selectedItems: items,
    averageDiscountAmount: extra.averageDiscountAmount ?? 0,
    averageDiscountType: extra.averageDiscountType ?? DiscountType.FLAT,
    shippingCost: 0,
    appliedPromotions: [],
    evaluatePromotionFn: () => ({ is_eligible: false }) as never,
  });
  return {
    totals,
    items: toSalePayloadItems(totals.discountedItems),
    expect: {
      subtotal: totals.subtotal.toFixed(2),
      tax_amount: totals.totalTax.toFixed(2),
      discount_amount: totals.finalDiscount.toFixed(2),
      total_amount: totals.total.toFixed(2),
    },
  };
}
const money = (n: number) => n.toFixed(2);

describe("POS checkout", () => {
  it("[CO-FLOW-POS-022] a printer HTTP rejection reports its reason without retrying the sale", async () => {
    localStorage.setItem("autoPrintThermal", "true");
    server.use(
      http.post(
        "http://localhost:8080/print",
        () => new Response("Printer out of paper", { status: 400 }),
      ),
    );
    const created = captureRequests("post", endpoints.createSale, { id: 106 });
    const { user } = mount();
    await addProduct(user, P1);
    await complete(user);
    await screen.findByText("Failed to print receipt: Printer out of paper");
    expect(screen.getByText("Sale created successfully!")).toBeInTheDocument();
    expect(created.calls).toHaveLength(1);
  });
  it("[CO-FLOW-POS-021] decreasing the restaurant quantity to zero removes the line and disables checkout", async () => {
    localStorage.setItem("posLayout", "restaurant");
    const created = captureRequests("post", endpoints.createSale);
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByRole("button", { name: `Decrease ${P1}` }));
    expect(await screen.findByText("Your order is empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Checkout/ })).toBeDisabled();
    expect(created.calls).toHaveLength(0);
  });
  it("[CO-FLOW-POS-020] adding the same menu product again scales its per-quantity discount", async () => {
    localStorage.setItem("posLayout", "restaurant");
    const created = captureRequests("post", endpoints.createSale, { id: 105 });
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByText("Per qty"));
    await setNumber(user, screen.getByRole("spinbutton"), "5");
    await user.click(
      screen.getAllByText(P1).find((node) => node.closest("article"))!,
    );
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body.items[0]).toMatchObject({
      quantity: 2,
      special_discount_amount: 10,
    });
  });
  it("[CO-FLOW-POS-019] a per-quantity discount scales when the restaurant quantity changes", async () => {
    localStorage.setItem("posLayout", "restaurant");
    const created = captureRequests("post", endpoints.createSale, { id: 104 });
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByText("Per qty"));
    await setNumber(user, screen.getByRole("spinbutton"), "5");
    await user.click(screen.getByRole("button", { name: `Increase ${P1}` }));
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body.items[0]).toMatchObject({
      quantity: 2,
      special_discount_amount: 10,
    });
  });
  it("[CO-FLOW-POS-018] restaurant order options retain selected customer, staff and shipping on checkout", async () => {
    localStorage.setItem("posLayout", "restaurant");
    server.use(
      http.get(`${API}${endpoints.getCustomers}`, () =>
        ok({ data: [{ id: 31, name: "C4 customer" }] }),
      ),
      http.get(`${API}${endpoints.user}`, () =>
        ok({ data: [{ id: 32, name: "C4 staff" }] }),
      ),
    );
    const created = captureRequests("post", endpoints.createSale, { id: 103 });
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByRole("button", { name: /Options/ }));
    const customer = screen
      .getByText("Walk-in customer")
      .closest(".ant-select")!;
    await user.click(within(customer as HTMLElement).getByRole("combobox"));
    await user.click(await screen.findByTitle("C4 customer"));
    await user.click(screen.getByLabelText("Served by"));
    await user.click(await screen.findByTitle("C4 staff"));
    await setNumber(user, screen.getByLabelText("Shipping cost"), "10");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
    );
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body).toMatchObject({
      customer_id: 31,
      served_by_id: 32,
      shipping_cost: 10,
    });
  });
  it("[CO-FLOW-POS-016] thermal receipt includes the backend's item and payment details", async () => {
    localStorage.setItem("autoPrintThermal", "true");
    const sale = responseContract<any>("sale-detail");
    const printed: any[] = [];
    server.use(
      http.post("http://localhost:8080/print", async ({ request }) => {
        printed.push(await request.json());
        return ok({ success: true });
      }),
    );
    const created = captureRequests("post", endpoints.createSale, sale);
    const { user } = mount();
    await addProduct(user, P2);
    await complete(user);
    await screen.findByText("Receipt sent to printer!");
    expect(created.calls).toHaveLength(1);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatchObject({
      saleNumber: sale.sale_number,
      total: Number(sale.total_amount),
    });
    expect(printed[0].items).toHaveLength(sale.items.length);
    expect(printed[0].items[0]).toMatchObject({
      quantity: sale.items[0].quantity,
    });
    expect(printed[0].payments).toHaveLength(sale.payments.length);
  });

  it("[CO-FLOW-POS-017] cancelling a sale requires confirmation and resets the cart", async () => {
    const created = captureRequests("post", endpoints.createSale);
    const { user } = mount();
    await addProduct(user, P1);
    await user.click(screen.getByRole("button", { name: /Cancel/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: /Yes|Confirm|Cancel Sale/ }),
    );
    await screen.findByText("Sale cancelled and form cleared.");
    expect(
      screen.getByRole("button", { name: /Complete Sale/ }),
    ).toBeDisabled();
    expect(created.calls).toHaveLength(0);
  });
  it("[CO-FLOW-POS-014] restaurant menu checkout records the same sale and clears the order", async () => {
    localStorage.setItem("posLayout", "restaurant");
    const created = captureRequests("post", endpoints.createSale, { id: 101 });
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body.items).toMatchObject([
      { variant_id: 1, quantity: 1, unit_price: 100 },
    ]);
    expect(screen.getByRole("button", { name: /Checkout/ })).toBeDisabled();
  });

  it("[CO-FLOW-POS-015] restaurant order options change payments and notes before checkout", async () => {
    localStorage.setItem("posLayout", "restaurant");
    const created = captureRequests("post", endpoints.createSale, { id: 102 });
    const { user } = mount();
    await user.click(await screen.findByText(P1));
    await user.click(screen.getByRole("button", { name: /Options/ }));
    await user.type(
      screen.getByPlaceholderText("Kitchen or sale notes..."),
      "Takeaway order",
    );
    await user.click(screen.getByRole("button", { name: /Add split payment/ }));
    const amounts = within(screen.getByRole("dialog")).getAllByRole(
      "spinbutton",
    );
    await setNumber(user, amounts[amounts.length - 2], "50");
    await setNumber(user, amounts[amounts.length - 1], "55");
    await user.type(
      screen.getAllByPlaceholderText("Reference")[0],
      "Cash desk",
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
    );
    await user.click(screen.getByRole("button", { name: /Checkout/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body.notes).toBe("Takeaway order");
    expect(created.calls[0].body.payments[0].reference).toBe("Cash desk");
  });

  it("[CO-FLOW-POS-001] a cash sale sends the cart, totals and payment the screen shows", async () => {
    const created = captureRequests("post", endpoints.createSale, {
      id: 1,
      sale_number: "S-1",
    });
    const { user } = mount();
    const cart = expectedCart([
      { product: P1, qty: 2 },
      { product: P3, qty: 1 },
    ]);
    await addProduct(user, P1);
    await addProduct(user, P1);
    await addProduct(user, P3);
    expect(totalOnScreen()).toContain(money(cart.totals.total));
    await complete(user);
    await screen.findByText("Sale created successfully!");

    expect(created.calls).toHaveLength(1);
    const body = created.calls[0].body;
    expect(body.items).toEqual(cart.items);
    expect(body).toMatchObject({
      branch_id: 1,
      price_type: "regular",
      payment_status: "paid",
      received_amount: cart.totals.total,
      payments: [{ payment_method: "CASH", amount: cart.totals.total }],
    });
    expectRequestContract("pos-cash-sale", {
      method: "POST",
      path: endpoints.createSale,
      auth: "client",
      body,
      expect: cart.expect,
    });
    // cart cleared, branch kept
    await waitFor(() => expect(totalOnScreen()).toContain("0.00"));
    expect(cartRow(P1)).toBeUndefined();
    expect(screen.getByText("Branch 1")).toBeInTheDocument();
  });

  it("[CO-FLOW-POS-002] a scanned barcode adds its variant and scanning again adds one more", async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${API}${endpoints.getProductByBarcode}`, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get("barcode") ?? "");
        return ok(byProduct(P3));
      }),
    );
    // The scanner hook only buffers keys that arrive within 100ms of each
    // other (Date.now deltas). On a loaded machine user.keyboard can exceed
    // that between keys and drop the start of the code, so freeze the clock:
    // every key then arrives "instantly", like a real scanner.
    vi.useFakeTimers({ toFake: ["Date"] });
    const { user } = mount();
    await screen.findByText(/Search or scan barcode/);
    await user.keyboard("BAR23{Enter}");
    await waitFor(() => expect(cartRow(P3)).toBeDefined());
    await user.keyboard("BAR23{Enter}");
    await waitFor(() =>
      expect(within(cartRow(P3)!).getAllByRole("spinbutton")[0]).toHaveValue(
        "2",
      ),
    );
    expect(asked).toEqual(["BAR23", "BAR23"]);
  });

  it("[CO-FLOW-POS-003] quantity, removal, special and average discounts reach the request as the totals util computes them", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 2 });
    const { user } = mount();
    await addProduct(user, P1);
    await addProduct(user, P2);
    await addProduct(user, P3);
    // quantity 1 → 3 on P1, drop P3, 5 off P2 on the line
    await setNumber(
      user,
      within(cartRow(P1)!).getAllByRole("spinbutton")[0],
      "3",
    );
    await user.click(within(cartRow(P3)!).getAllByRole("button").slice(-1)[0]);
    await waitFor(() => expect(cartRow(P3)).toBeUndefined());
    await setNumber(
      user,
      within(cartRow(P2)!).getAllByRole("spinbutton")[1],
      "5",
    );
    // 10% off the whole sale
    await user.click(screen.getByRole("img", { name: "percentage" }));
    const avg = document.getElementById("average_discount_amount")!;
    await setNumber(user, avg, "10");
    const cart = expectedCart(
      [
        { product: P1, qty: 3 },
        { product: P2, qty: 1, special: 5 },
      ],
      {
        averageDiscountAmount: 10,
        averageDiscountType: DiscountType.PERCENTAGE,
      },
    );
    await waitFor(() =>
      expect(totalOnScreen()).toContain(money(cart.totals.total)),
    );
    await complete(user);
    await screen.findByText("Sale created successfully!");
    const body = created.calls[0].body;
    expect(body.items).toEqual(cart.items);
    expect(body.discount_amount).toBe(cart.totals.finalDiscount);
    expectRequestContract("pos-discounts-sale", {
      method: "POST",
      path: endpoints.createSale,
      auth: "client",
      body,
      expect: cart.expect,
    });
  }, 60_000);

  it("[CO-FLOW-POS-004] a split cash + MFS payment needs the provider and sends both payments", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 3 });
    const { user } = mount();
    await addProduct(user, P2);
    const cart = expectedCart([{ product: P2, qty: 1 }]);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    const amounts = await screen.findAllByPlaceholderText("Amount");
    expect(amounts).toHaveLength(2);
    // first payment: 100 cash; second: the rest by MFS
    await setNumber(user, amounts[0], "100");
    await setNumber(user, amounts[1], String(cart.totals.total - 100));
    const methods = screen
      .getAllByRole("combobox")
      .filter((c) => c.closest(".ant-select")?.textContent?.includes("Cash"));
    await user.click(methods[methods.length - 1]);
    const mfs = await screen.findAllByText("MFS");
    await user.click(mfs[mfs.length - 1]);
    // without a provider the sale is refused and nothing is sent
    await complete(user);
    await screen.findByText(/MFS payment must have a payment type selected/);
    expect(created.calls).toHaveLength(0);

    const provider = await screen.findByText("Select MFS");
    await user.click(
      within(provider.closest(".ant-select") as HTMLElement).getByRole(
        "combobox",
      ),
    );
    const bkash = await screen.findByTitle(/bKash/i);
    await user.click(bkash);
    await complete(user);
    await screen.findByText("Sale created successfully!");
    const body = created.calls[0].body;
    expect(body.payments).toHaveLength(2);
    expect(body.payments[0]).toMatchObject({
      payment_method: "CASH",
      amount: 100,
    });
    expect(body.payments[1]).toMatchObject({
      payment_method: "MFS",
      payment_type: expect.any(String),
    });
    expect(body.payments[1].amount).toBeCloseTo(cart.totals.total - 100, 2);
    expectRequestContract("pos-split-payment", {
      method: "POST",
      path: endpoints.createSale,
      auth: "client",
      body,
      expect: cart.expect,
    });
  });

  it("[CO-FLOW-POS-005] paying less than the total is partial; paying nothing is due", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 4 });
    const { user } = mount();
    await addProduct(user, P2);
    await setNumber(user, screen.getByPlaceholderText("Amount"), "100");
    await complete(user);
    await screen.findByText("Sale created successfully!");
    expect(created.calls[0].body).toMatchObject({
      payment_status: "partial",
      received_amount: 100,
    });

    await addProduct(user, P2);
    await setNumber(user, screen.getByPlaceholderText("Amount"), "0");
    await complete(user);
    await waitFor(() => expect(created.calls).toHaveLength(2));
    expect(created.calls[1].body).toMatchObject({
      payment_status: "due",
      received_amount: 0,
      payments: [],
    });
  });

  it("[CO-FLOW-POS-009] a server refusal is shown, the cart stays, the button works again, one request was sent", async () => {
    const created = captureRequests("post", endpoints.createSale, () =>
      fail(400, "Insufficient stock for Product 5"),
    );
    const { user } = mount();
    await addProduct(user, P1);
    await complete(user);
    await screen.findByText("Insufficient stock for Product 5");
    expect(created.calls).toHaveLength(1);
    expect(cartRow(P1)).toBeDefined();
    expect(screen.getByRole("button", { name: /Complete Sale/ })).toBeEnabled();
  });

  it("[CO-FLOW-POS-010] double-clicking Complete Sale sends one request", async () => {
    const created = captureRequests(
      "post",
      endpoints.createSale,
      () =>
        new Response(JSON.stringify({ id: 5 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { user } = mount();
    await addProduct(user, P1);
    await user.dblClick(screen.getByRole("button", { name: /Complete Sale/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
  });

  it("[CO-FLOW-POS-006] an auto promotion is applied to the matching line and its id is sent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    try {
      const promo = {
        ...responseContract<any[]>("promotions-active")[0],
        auto_apply: true,
      };
      server.use(
        http.get(`${API}${endpoints.activePromotions}`, () => ok([promo])),
      );
      const created = captureRequests("post", endpoints.createSale, { id: 6 });
      const { user } = mount();
      await addProduct(user, P1);
      await screen.findByText("Promotion 26 auto-applied");
      await complete(user);
      await screen.findByText("Sale created successfully!");
      const [line] = created.calls[0].body.items;
      expect(line).toMatchObject({
        variant_id: 1,
        promotion_discount_amount: 10,
        applied_promotion_id: promo.id,
      });
      const cart = expectedCart([{ product: P1, qty: 1 }]);
      expectRequestContract("pos-promotion-sale", {
        method: "POST",
        path: endpoints.createSale,
        auth: "client",
        body: created.calls[0].body,
        expect: {
          ...cart.expect,
          discount_amount: "10.00",
          total_amount: (cart.totals.total - 10).toFixed(2),
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("[CO-FLOW-POS-007] a members-only promotion is refused without a customer and the reason is shown", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
    try {
      const promo = {
        ...responseContract<any[]>("promotions-active")[0],
        member_only: true,
      };
      server.use(
        http.get(`${API}${endpoints.activePromotions}`, () => ok([promo])),
      );
      const { user } = mount();
      await addProduct(user, P1);
      await user.click(await screen.findByRole("button", { name: /Promos/ }));
      await user.click(await screen.findByRole("button", { name: "Apply" }));
      expect(
        (
          await screen.findAllByText(
            "This promotion is for registered customers only",
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.queryByText(/applied$/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("[CO-FLOW-POS-008] switching to wholesale prices the lines at the wholesale price and says so in the request", async () => {
    const wholesale = variants.map((v) => ({
      ...v,
      wholesale_price: "80" as unknown as number,
    }));
    server.use(
      http.get(`${API}${endpoints.getProductsForSale}`, () => ok(wholesale)),
    );
    const created = captureRequests("post", endpoints.createSale, { id: 7 });
    const { user } = mount();
    await addProduct(user, P1);
    await user.click(screen.getByRole("button", { name: /Retail/ }));
    await screen.findByRole("button", { name: /Wholesale/ });
    await addProduct(user, P3);
    const cart = expectedCart(
      [
        { product: P1, qty: 1 },
        { product: P3, qty: 1 },
      ],
      { priceType: PriceType.WHOLESALE, variantList: wholesale },
    );
    await complete(user);
    await screen.findByText("Sale created successfully!");
    expect(created.calls[0].body.price_type).toBe("wholesale");
    // every line in the cart is sold at the wholesale price, including the one added before the switch
    expect(created.calls[0].body.items.map((i: any) => i.unit_price)).toEqual(
      cart.items.map((i: any) => i.unit_price),
    );
    expect(created.calls[0].body.items[0].unit_price).toBe(80);
  });

  it("[CO-FLOW-POS-011] auto-print sends the receipt to the local agent; an agent that is down does not undo the sale", async () => {
    localStorage.setItem("autoPrintThermal", "true");
    const printed: any[] = [];
    server.use(
      http.post("http://localhost:8080/print", async ({ request }) => {
        printed.push(await request.json());
        return ok({ success: true });
      }),
    );
    const created = captureRequests("post", endpoints.createSale, {
      id: 8,
      sale_number: "S-8",
      total_amount: "105",
      items: [],
      payments: [],
    });
    const { user } = mount();
    await addProduct(user, P1);
    await complete(user);
    await screen.findByText("Receipt sent to printer!");
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(printed).toHaveLength(1);
    expect(printed[0]).toMatchObject({ saleNumber: "S-8" });
    await waitFor(
      () =>
        expect(
          screen.queryByText("Sale created successfully!"),
        ).not.toBeInTheDocument(),
      { timeout: 5000 },
    );

    server.use(
      http.post("http://localhost:8080/print", () => Response.error()),
    );
    await addProduct(user, P1);
    await complete(user);
    await screen.findByText(/Printing agent is not running/);
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(2);
  });

  it("[CO-FLOW-POS-012] a completed sale refreshes every report", async () => {
    captureRequests("post", endpoints.createSale, { id: 9 });
    const { user, queryClient } = mount();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await addProduct(user, P1);
    await complete(user);
    await screen.findByText("Sale created successfully!");
    const invalidated = spy.mock.calls.map(([f]) => (f as any).queryKey[0]);
    for (const key of [
      queryKeys.sales,
      queryKeys.dashboardAnalytics,
      queryKeys.eod,
      queryKeys.dailyTarget,
      queryKeys.salesStats,
      queryKeys.userSalesStats,
      queryKeys.variantSalesStats,
      queryKeys.productsForSale,
    ]) {
      expect(invalidated).toContain(key);
    }
  });
});

afterEach(() => vi.useRealTimers());
