import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { Permissions } from "../../../constants/permissions";
import { responseContract } from "../../../test/contracts/load";
import {
  expectRequestContract,
  requestContract,
} from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import AddQuotation from "../index";

const variants = responseContract<any[]>("products-for-sale");

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () => ok(variants)),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
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

describe("Add quotation", () => {
  it("[CO-FLOW-QUO-001] a quotation is sent as a quotation with the same lines as a sale and no payments", async () => {
    const created = captureRequests("post", endpoints.createQuotation, {
      id: 11,
    });
    const { user } = renderWithProviders(<AddQuotation />, {
      route: "/quotations/new",
      path: "/quotations/new",
      permissions: [Permissions.sales],
    });
    await addProduct(user, "Product 5 - Default");
    await addProduct(user, "Product 5 - Default");
    await addProduct(user, "Product 19 - Default");
    await user.click(screen.getByRole("button", { name: /Save Quotation/ }));
    await screen.findByText("Quotation created successfully!");
    const body = created.calls[0].body;
    expect(body).toMatchObject({
      sale_type: "quotation",
      payment_status: "due",
      received_amount: 0,
      payments: [],
    });
    expect(body.items).toEqual(
      (requestContract("pos-cash-sale").body as { items: unknown }).items,
    );
    const sale = requestContract("pos-cash-sale");
    expectRequestContract("quotation", {
      method: "POST",
      path: endpoints.createQuotation,
      auth: "client",
      body,
      expect: { ...sale.expect },
    });
  });

  it("[CO-FLOW-QUO-CUST-001] typing in the customer box searches customers on the server, so anyone past the first 100 can be found", async () => {
    const searches: string[] = [];
    server.use(
      http.get(`${API}${endpoints.getCustomers}`, ({ request }) => {
        const search = new URL(request.url).searchParams.get("search") ?? "";
        searches.push(search);
        return ok({
          data: search
            ? [{ id: 501, name: "Zed Far", phone: "0170000501" }]
            : [{ id: 1, name: "First Customer", phone: "0171" }],
        });
      }),
    );
    const { user } = renderWithProviders(<AddQuotation />, {
      route: "/quotations/new",
      path: "/quotations/new",
      permissions: [Permissions.sales],
    });
    const placeholder = await screen.findByText("Select customer");
    const box = within(
      placeholder.closest(".ant-select") as HTMLElement,
    ).getByRole("combobox");
    await user.type(box, "zed");
    expect(await screen.findByText(/Zed Far/)).toBeInTheDocument();
    expect(searches).toContain("zed");
  });
});
