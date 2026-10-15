import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { requestContract } from "../../../test/contracts/record";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import { Permissions } from "../../../constants/permissions";
import AddSale from "../index";

const variants = responseContract<any[]>("products-for-sale");

// Fields only this screen adds (online-order and delivery switches); everything else must match the POS payload
const SCREEN_ONLY = ["is_online_order", "is_delivery_later"];
const withoutScreenOnly = (body: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(body).filter(([key]) => !SCREEN_ONLY.includes(key)),
  );

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () => ok(variants)),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
});

const mount = () =>
  renderWithProviders(<AddSale />, {
    route: "/sales/new",
    path: "/sales/new",
    permissions: [Permissions.sales],
  });

async function addProduct(user: UserEvent, label: string) {
  const placeholder = await screen.findByText("Search and select products...");
  const box = within(
    placeholder.closest(".ant-select") as HTMLElement,
  ).getByRole("combobox");
  await waitFor(() => expect(box).toBeEnabled());
  await user.click(box);
  const rows = await screen.findAllByText(label);
  await user.click(rows[rows.length - 1]);
}

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
const row = (label: string) =>
  screen
    .queryAllByRole("row")
    .find(
      (r) =>
        r.textContent?.includes(label) &&
        within(r).queryAllByRole("spinbutton").length > 0,
    ) as HTMLElement;

describe("Add sale", () => {
  it("[CO-FLOW-SALE-007] adding a duplicate product scales a per-quantity special discount", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 7 });
    const { user } = mount();
    await addProduct(user, "Product 5 - Default");
    const line = row("Product 5");
    await user.click(within(line).getByText("Per qty"));
    await setNumber(user, within(line).getAllByRole("spinbutton")[1], "5");
    await addProduct(user, "Product 5 - Default");
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body.items[0]).toMatchObject({
      quantity: 2,
      special_discount_amount: 10,
    });
  });
  it("[CO-FLOW-SALE-005] barcode entry adds a variant and an unpaid checkout sends due status", async () => {
    const product = variants[0];
    server.use(
      http.get(`${API}${endpoints.getProductByBarcode}`, () => ok(product)),
    );
    const created = captureRequests("post", endpoints.createSale, { id: 5 });
    const { user } = mount();
    await screen.findByText("Search and select products...");
    await user.keyboard(`${product.barcode}{Enter}`);
    await screen.findByText(
      `Added ${product.product_name} - ${product.name} to sale`,
    );
    await setNumber(user, screen.getByPlaceholderText("0.00"), "0");
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body).toMatchObject({
      payment_status: "due",
      received_amount: 0,
      payments: [],
      items: [{ variant_id: product.id, quantity: 1 }],
    });
  });

  it("[CO-FLOW-SALE-006] a payment below the invoice total sends partial status", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 6 });
    const { user } = mount();
    await addProduct(user, "Product 5 - Default");
    await setNumber(user, screen.getByPlaceholderText("0.00"), "30");
    await user.type(screen.getByPlaceholderText("Reference"), "Cash desk");
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body).toMatchObject({
      payment_status: "partial",
      received_amount: 30,
      payments: [
        { payment_method: "CASH", amount: 30, reference: "Cash desk" },
      ],
    });
  });
  it("[CO-FLOW-SALE-003] split cash and MFS payments match the POS recording", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 3 });
    const { user } = mount();
    await addProduct(user, "Product 12 - Default");
    await user.click(
      screen.getByRole("button", { name: /Add Payment Method/ }),
    );
    const amounts = screen.getAllByPlaceholderText("0.00");
    await setNumber(user, amounts[0], "100");
    await setNumber(user, amounts[1], "150");
    const methods = screen
      .getAllByRole("combobox")
      .filter((c) => c.closest(".ant-select")?.textContent?.includes("Cash"));
    await user.click(methods[methods.length - 1]);
    const mfs = await screen.findAllByText("MFS");
    await user.click(mfs[mfs.length - 1]);
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText(/MFS payment must have a payment type selected/);
    expect(created.calls).toHaveLength(0);
    const provider = screen.getByText("Select MFS").closest(".ant-select")!;
    await user.click(within(provider as HTMLElement).getByRole("combobox"));
    await user.click(await screen.findByTitle(/bKash/i));
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText("Sale created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(withoutScreenOnly(created.calls[0].body)).toEqual(
      requestContract("pos-split-payment").body,
    );
  });

  it("[CO-FLOW-SALE-004] a server rejection preserves the cart and permits another attempt", async () => {
    const created = captureRequests("post", endpoints.createSale, () =>
      fail(400, "Insufficient stock"),
    );
    const { user } = mount();
    await addProduct(user, "Product 5 - Default");
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await screen.findByText("Insufficient stock");
    expect(created.calls).toHaveLength(1);
    expect(row("Product 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Sale/ })).toBeEnabled();
  });
  it("[CO-FLOW-SALE-001] the same cart as the POS cash sale sends the same payload", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 1 });
    const { user } = mount();
    await addProduct(user, "Product 5 - Default");
    await addProduct(user, "Product 5 - Default");
    await addProduct(user, "Product 19 - Default");
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await waitFor(() => expect(created.calls).toHaveLength(1));
    const pos = requestContract("pos-cash-sale");
    expect(withoutScreenOnly(created.calls[0].body)).toEqual(pos.body);
  });

  it("[CO-FLOW-SALE-002] the same discounts as the POS discounts sale send the same payload", async () => {
    const created = captureRequests("post", endpoints.createSale, { id: 2 });
    const { user } = mount();
    await addProduct(user, "Product 5 - Default");
    await addProduct(user, "Product 12 - Default");
    await addProduct(user, "Product 19 - Default");
    await setNumber(
      user,
      within(row("Product 5")).getAllByRole("spinbutton")[0],
      "3",
    );
    await user.click(
      within(row("Product 19")).getAllByRole("button").slice(-1)[0],
    );
    await waitFor(() => expect(row("Product 19")).toBeUndefined());
    await setNumber(
      user,
      within(row("Product 12")).getAllByRole("spinbutton")[1],
      "5",
    );
    await user.click(screen.getByRole("radio", { name: "Percent" }));
    await setNumber(
      user,
      document.getElementById("average_discount_amount")!,
      "10",
    );
    await user.click(screen.getByRole("button", { name: /Create Sale/ }));
    await waitFor(() => expect(created.calls).toHaveLength(1));
    const pos = requestContract("pos-discounts-sale");
    expect(withoutScreenOnly(created.calls[0].body)).toEqual(pos.body);
  });
  it("[CO-FLOW-SALE-008] converting a quotation keeps the product tax when the capped product list omits the variant", async () => {
    const quotation = responseContract<any>("quotation-detail");
    server.use(
      http.get(`${API}${endpoints.getProductsForSale}`, () =>
        ok(
          variants.filter(
            (variant) => variant.id !== quotation.items[0].variant_id,
          ),
        ),
      ),
      http.get(`${API}${endpoints.getQuotation(quotation.id)}`, () =>
        ok(quotation),
      ),
    );
    const created = captureRequests("post", endpoints.createSale, { id: 9 });
    const { user } = renderWithProviders(<AddSale />, {
      route: `/sales/new?quotation_id=${quotation.id}`,
      path: "/sales/new",
      permissions: [Permissions.sales],
    });
    await waitFor(() => expect(row("Product 5")).toBeDefined());
    await user.click(
      await screen.findByRole("button", { name: /Create Sale/ }),
    );
    await waitFor(() => expect(created.calls).toHaveLength(1));
    expect(created.calls[0].body.items[0]).toMatchObject({
      quantity: 3,
      tax_amount: 15,
      line_total: 315,
    });
  });
});
