import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import type { ProductVariantForSale } from "../../../types/sale.types";
import POS from "../index";

const variants = responseContract<ProductVariantForSale[]>("products-for-sale");

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () => ok(variants)),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
});

async function checkoutWith(respond: () => Response) {
  const created = captureRequests("post", endpoints.createSale, respond);
  const { user } = renderWithProviders(<POS />, {
    route: "/pos",
    path: "/pos",
  });
  const placeholder = await screen.findByText(/Search or scan barcode/);
  const box = within(
    placeholder.closest(".ant-select") as HTMLElement,
  ).getByRole("combobox");
  await waitFor(() => expect(box).toBeEnabled());
  await (user as UserEvent).click(box);
  const rows = await screen.findAllByText("Product 5");
  await user.click(rows[rows.length - 1]);
  await user.click(screen.getByRole("button", { name: /Complete Sale/ }));
  return created;
}

const cartKept = () =>
  screen
    .queryAllByRole("row")
    .some(
      (row) =>
        row.textContent?.includes("Product 5") &&
        within(row).queryAllByRole("spinbutton").length > 0,
    );

describe("POS checkout errors", () => {
  it("[CO-ERR-020] shows the exact stock message and keeps the cart", async () => {
    const message =
      "Insufficient stock for variant 7. Available: 1, Requested: 2";
    await checkoutWith(() => fail(400, message));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(cartKept()).toBe(true);
  });

  it("[CO-ERR-021] shows the stale price message", async () => {
    const message =
      "Price of variant 7 has changed (now 120.00). Refresh the product list and try again.";
    await checkoutWith(() => fail(400, message));
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("[CO-ERR-022] turns an array of validation messages into one readable string", async () => {
    await checkoutWith(() =>
      HttpResponse.json(
        { statusCode: 400, message: ["Quantity must be at least 1 (line 1)."] },
        { status: 400 },
      ),
    );
    expect(
      await screen.findByText("Quantity must be at least 1 (line 1)."),
    ).toBeInTheDocument();
  });

  it("[CO-ERR-023] explains an unreachable server", async () => {
    await checkoutWith(() => HttpResponse.error());
    expect(
      await screen.findByText(
        "Can't reach the server. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
  });

  it("[CO-ERR-024] shows the fallback for a 500 and never [object Object]", async () => {
    await checkoutWith(() => fail(500, "Failed to create sale"));
    expect(
      await screen.findByText("Failed to create sale"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it("[CO-ERR-031] shows a friendly message for the generic 403", async () => {
    await checkoutWith(() => fail(403, "Forbidden resource"));
    expect(
      await screen.findByText("You don't have permission to do this."),
    ).toBeInTheDocument();
  });

  it("[CO-ERR-027] a duplicate customer shows the server's message, not a generic failure", async () => {
    const message = "A customer with this phone number already exists";
    const created = captureRequests("post", endpoints.createCustomer, () =>
      fail(409, message),
    );
    const { user } = renderWithProviders(<POS />, {
      route: "/pos",
      path: "/pos",
    });
    await user.click(await screen.findByRole("button", { name: /^plus$/ }));
    await user.type(
      await screen.findByPlaceholderText("Enter customer name"),
      "Rahim",
    );
    await user.type(
      screen.getByPlaceholderText("Enter phone number"),
      "01700000000",
    );
    const type = screen
      .getByRole("dialog")
      .querySelectorAll(".ant-select")[0] as HTMLElement;
    await user.click(within(type).getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    await user.click(options[0]);
    await user.click(
      screen.getByRole("button", { name: /Create|Add Customer|Save|Submit/ }),
    );
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(created.calls).toHaveLength(1);
  });
});
