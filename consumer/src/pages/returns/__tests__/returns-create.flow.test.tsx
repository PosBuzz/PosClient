import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { queryKeys } from "../../../constants/queryKeys";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Create from "../create";

const sale = responseContract<any>("sale-by-number");
// sale-by-number: 5 × Product 19 at 40, 3 still returnable, line_total 180 (after a 20 discount)
const PRORATED_ONE_UNIT = 36;

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getSaleBySaleNumber(sale.sale_number)}`, () =>
      ok(sale),
    ),
  );
});

const mount = () =>
  renderWithProviders(<Create />, {
    route: "/returns/create",
    path: "/returns/create",
  });

async function loadSale(user: UserEvent) {
  await user.type(
    await screen.findByPlaceholderText("SAL-20250926-0001"),
    sale.sale_number,
  );
  await user.click(screen.getByRole("button", { name: /Search/ }));
  await screen.findByText(/loaded successfully/);
}
async function pickOption(user: UserEvent, id: string, label: string) {
  await user.click(document.getElementById(id)!);
  const options = await screen.findAllByText(label);
  await user.click(options[options.length - 1]);
}
async function addPayment(user: UserEvent, method: string, amount?: string) {
  const open = screen.getAllByRole("button", { name: /Add Payment/ });
  await user.click(open[0]);
  await pickOption(user, "payment_method", method);
  if (amount !== undefined) {
    const input = document.getElementById("amount") as HTMLInputElement;
    await user.type(input, amount, {
      initialSelectionStart: 0,
      initialSelectionEnd: input.value.length,
    });
  }
  const buttons = screen.getAllByRole("button", { name: /Add Payment/ });
  await user.click(buttons[buttons.length - 1]);
}
const createReturn = (user: UserEvent) =>
  user.click(screen.getByRole("button", { name: /Create Return/ }));

describe("Create return", () => {
  it("[CO-FLOW-RET-001] looking up a sale lists its items with the quantity still returnable", async () => {
    const { user } = mount();
    await loadSale(user);
    const row = screen
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Product 19"))!;
    const cells = within(row)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells.slice(1, 4)).toEqual(["5", "3", "40.00"]);
  });

  it("[CO-FLOW-RET-002] returning one unit pre-fills the prorated refund and sends the return", async () => {
    const created = captureRequests("post", endpoints.createReturn, { id: 21 });
    const { user } = mount();
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    await pickOption(user, "reason", "Defective");
    await user.click(screen.getAllByRole("button", { name: /Add Payment/ })[0]);
    await pickOption(user, "payment_method", "CASH");
    expect((document.getElementById("amount") as HTMLInputElement).value).toBe(
      PRORATED_ONE_UNIT.toFixed(2),
    );
    const buttons = screen.getAllByRole("button", { name: /Add Payment/ });
    await user.click(buttons[buttons.length - 1]);
    await createReturn(user);
    await screen.findByText("Return created successfully!");
    expect(created.calls).toHaveLength(1);
    const body = created.calls[0].body;
    expect(body).toMatchObject({
      original_sale_id: sale.id,
      branch_id: 1,
      reason: "Defective",
      shipping_refund_amount: 0,
      items: [{ quantity: 1, variant_id: 3, batch_id: 5 }],
      payments: [{ payment_method: "CASH", amount: PRORATED_ONE_UNIT }],
    });
    expectRequestContract("return-cash", {
      method: "POST",
      path: endpoints.createReturn,
      auth: "client",
      body,
    });
  });

  it("[CO-FLOW-RET-003] a refund that does not match the selected value cannot be submitted", async () => {
    const created = captureRequests("post", endpoints.createReturn, { id: 22 });
    const { user } = mount();
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    await addPayment(user, "CASH", "50");
    await screen.findByText(
      /Payment amount must match selected return value\. Entered BDT 50\.00/,
    );
    const submit = screen.getByRole("button", { name: /Create Return/ });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(created.calls).toHaveLength(0);
  });

  it("[CO-FLOW-RET-005] a shipping refund above what is left cannot be submitted", async () => {
    const created = captureRequests("post", endpoints.createReturn, { id: 23 });
    const { user } = mount();
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    expect(
      await screen.findByText(/Maximum refundable shipping: .*60\.00/),
    ).toBeInTheDocument();
    const shipping = document.getElementById(
      "shipping_refund_amount",
    ) as HTMLInputElement;
    await user.type(shipping, "999", {
      initialSelectionStart: 0,
      initialSelectionEnd: shipping.value.length,
    });
    await addPayment(user, "CASH");
    const submit = screen.getByRole("button", { name: /Create Return/ });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(created.calls).toHaveLength(0);
  });

  it("[CO-FLOW-RET-004] an exchange links the replacement sale and records an EXCHANGE payment", async () => {
    const exchange = { ...sale, id: 99, sale_number: "SAL-EXCHANGE-0099" };
    server.use(
      http.get(
        `${API}${endpoints.getSaleBySaleNumber(exchange.sale_number)}`,
        () => ok(exchange),
      ),
      http.get(`${API}${endpoints.getSale(exchange.id)}`, () => ok(exchange)),
    );
    const created = captureRequests("post", endpoints.createReturn, { id: 25 });
    const { user } = mount();
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    await pickOption(user, "return_type", "Exchange");
    await user.type(
      screen.getByPlaceholderText(/Enter exchange sale number/),
      exchange.sale_number,
    );
    await user.click(screen.getByRole("button", { name: /Search Exchange/ }));
    await screen.findByText(/✓ Exchange Sale Loaded/);
    await pickOption(user, "reason", "Defective");
    await addPayment(user, "EXCHANGE");
    await createReturn(user);
    await screen.findByText("Return created successfully!");
    expect(created.calls).toHaveLength(1);
    expect(created.calls[0].body).toMatchObject({
      exchange_sale_id: exchange.id,
      original_sale_id: sale.id,
      payments: [{ payment_method: "EXCHANGE", amount: PRORATED_ONE_UNIT }],
    });
    expectRequestContract("return-exchange", {
      method: "POST",
      path: endpoints.createReturn,
      auth: "client",
      body: created.calls[0].body,
    });
  });

  it("[CO-FLOW-RET-006] a successful return refreshes every report", async () => {
    captureRequests("post", endpoints.createReturn, { id: 24 });
    const { user, queryClient } = mount();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    await addPayment(user, "CASH");
    await createReturn(user);
    await screen.findByText("Return created successfully!");
    const keys = spy.mock.calls.map(([f]) => (f as any).queryKey[0]);
    for (const key of [
      queryKeys.returns,
      queryKeys.dashboardAnalytics,
      queryKeys.eod,
      queryKeys.sales,
    ]) {
      expect(keys).toContain(key);
    }
  });

  it("[CO-FLOW-RET-007] a server error is shown and the return is sent once", async () => {
    const created = captureRequests("post", endpoints.createReturn, () =>
      fail(500, "Internal server error"),
    );
    const { user } = mount();
    await loadSale(user);
    await user.click(screen.getByRole("button", { name: "+" }));
    await addPayment(user, "CASH");
    await createReturn(user);
    await screen.findByText(/Internal server error|Failed to create return/);
    await waitFor(() => expect(created.calls).toHaveLength(1));
  });
});
