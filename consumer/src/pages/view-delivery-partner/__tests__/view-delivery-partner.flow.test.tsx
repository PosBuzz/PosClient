import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import { balanceLabel } from "../../../utils/delivery-partner.utils";
import ViewDeliveryPartner from "../index";

process.env.TZ = "Asia/Dhaka";

const summary = responseContract<any>("delivery-partner-summary");
const orders = responseContract<any>("delivery-partner-orders");
const ledger = responseContract<any>("delivery-partner-ledger");
const settlements = responseContract<any>("delivery-partner-settlements");
const id = summary.partner.id;
const base = `/consumer/delivery-partners/${id}`;
const label = balanceLabel(summary.balance).text;

beforeEach(() => {
  server.use(
    http.get(`${API}${base}/summary`, () => ok(summary)),
    http.get(`${API}${base}/orders`, () => ok(orders)),
    http.get(`${API}${base}/ledger`, () => ok(ledger)),
    http.get(`${API}${base}/settlements`, () => ok(settlements)),
  );
});

const mount = () =>
  renderWithProviders(<ViewDeliveryPartner />, {
    route: `/delivery-partners/view/${id}`,
    path: "/delivery-partners/view/:id",
  });

it("[CO-DP-020] the backend summary shows the balance in words and the orders waiting for a payout", async () => {
  const errors = vi.spyOn(console, "error");
  mount();
  await screen.findByText(label);
  const order = orders.data[0];
  expect(
    await screen.findByRole("link", { name: order.sale_number }),
  ).toHaveAttribute("href", `/sales/view/${order.id}`);
  expect(
    screen.getByText(`Waiting for payout (${summary.unsettled.orders})`),
  ).toBeInTheDocument();
  expect(errors).not.toHaveBeenCalled();
});

it("[CO-DP-021] a payout for the chosen orders is prefilled with their net and settles exactly those orders", async () => {
  const captured = captureRequests("post", `${base}/settlements`, {
    id: 50,
    amount: 1,
  });
  const { user } = mount();
  const order = orders.data[0];
  const link = await screen.findByRole("link", { name: order.sale_number });
  await user.click(within(link.closest("tr")!).getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: /Record payout for 1 order/ }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("Amount received")).toHaveValue(
    Number(order.net).toFixed(2),
  );
  await user.type(within(dialog).getByLabelText("Reference"), "TRX-9");
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await screen.findByText("Payout recorded");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    direction: "RECEIVED",
    amount: order.net,
    payment_method: "BANK_TRANSFER",
    reference: "TRX-9",
    sale_ids: [order.id],
  });
  expect(captured.calls[0].body.adjust_difference).toBeUndefined();
});

it("[CO-DP-022] a short payout can write the difference off", async () => {
  const captured = captureRequests("post", `${base}/settlements`, { id: 51 });
  const { user } = mount();
  const order = orders.data[0];
  const link = await screen.findByRole("link", { name: order.sale_number });
  await user.click(within(link.closest("tr")!).getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: /Record payout for 1 order/ }),
  );
  const dialog = await screen.findByRole("dialog");
  const amount = within(dialog).getByLabelText("Amount received");
  await user.clear(amount);
  await user.type(amount, String(Number(order.net) - 5));
  await user.click(await within(dialog).findByRole("checkbox"));
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await screen.findByText("Payout recorded");
  expect(captured.calls[0].body).toMatchObject({
    amount: Number(order.net) - 5,
    adjust_difference: true,
    sale_ids: [order.id],
  });
});

it("[CO-DP-023] voiding a payout needs a reason and sends it", async () => {
  const settlement = settlements.data[0];
  const captured = captureRequests(
    "post",
    `${base}/settlements/${settlement.id}/void`,
    { success: true },
  );
  const { user } = mount();
  await screen.findByText(label);
  await user.click(screen.getByRole("tab", { name: "Payouts" }));
  await user.click(await screen.findByRole("button", { name: "Void" }));
  const dialog = await screen.findByRole("dialog");
  const ok = within(dialog).getByRole("button", { name: "Void payout" });
  expect(ok).toBeDisabled();
  await user.type(within(dialog).getByRole("textbox"), "entered twice");
  await user.click(ok);
  await screen.findByText(/Payout voided/);
  expect(captured.calls[0].body).toEqual({ reason: "entered twice" });
});

it("[CO-DP-024] the ledger lists entries with the balance after each", async () => {
  const { user } = mount();
  await screen.findByText(label);
  await user.click(screen.getByRole("tab", { name: "Ledger" }));
  const first = ledger.data[0];
  const cell = await screen.findByText(first.note);
  expect(cell.closest("tr")).toHaveTextContent(
    Number(first.balance_after).toFixed(2),
  );
});
