import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { selectAntdOption } from "../../../test/antd";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import { codFee, owedByCustomer } from "../../../utils/delivery-partner.utils";
import OnlineOrders from "../index";

process.env.TZ = "Asia/Dhaka";

const list = responseContract<any>("online-orders-list");
const partners = responseContract<any[]>("delivery-partners-list");
const order = list.data[0];
const partner = partners[0];

beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getSales}/online-orders/list`, () => ok(list)),
    http.get(`${API}${endpoints.getSales}/online-orders/stats`, () =>
      ok(responseContract("online-orders-stats")),
    ),
    http.get(`${API}/consumer/delivery-partners`, () => ok(partners)),
  );
});

/** Status options render as tags without a title, so pick them by their text. */
const pickStatus = async (user: any, combobox: HTMLElement, text: string) => {
  await user.click(combobox);
  const option = (await screen.findAllByText(text)).find((el) =>
    el.closest(".ant-select-item-option"),
  );
  await user.click(option!);
};

const openEdit = async () => {
  const view = renderWithProviders(<OnlineOrders />);
  const cell = await view.findAllByText(order.sale_number);
  await view.user.click(
    within(cell[0].closest("tr")!).getByRole("button", { name: /Edit Order/ }),
  );
  return { ...view, dialog: await screen.findByRole("dialog") };
};

it("[CO-DP-030] choosing a partner fills in the cash to collect and its charges, and delivering sends them", async () => {
  const captured = captureRequests(
    "patch",
    `${endpoints.getSales}/online-orders/${order.id}/status`,
    order,
  );
  const { user, dialog } = await openEdit();
  const [status, partnerSelect] = within(dialog).getAllByRole("combobox");
  await selectAntdOption(user, partnerSelect, partner.name);
  const owed = owedByCustomer(order);
  expect(within(dialog).getByLabelText("Cash to collect")).toHaveValue(
    owed.toFixed(2),
  );
  expect(within(dialog).getByLabelText("Delivery charge")).toHaveValue(
    Number(partner.default_delivery_charge).toFixed(2),
  );
  await pickStatus(user, status, "Delivered");
  await screen.findByText(
    /Once delivered, (the partner owes you|you owe the partner)/,
  );
  await user.click(within(dialog).getByRole("button", { name: "OK" }));
  await screen.findByText("Order updated successfully");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toEqual({
    status: "DELIVERED",
    delivery_partner_id: partner.id,
    cod_amount: owed,
    delivery_charge: Number(partner.default_delivery_charge),
    cod_fee: codFee(owed, partner.default_cod_fee_percent),
  });
});

it("[CO-DP-031] only changing the status keeps the partner untouched and sends no amounts", async () => {
  const captured = captureRequests(
    "patch",
    `${endpoints.getSales}/online-orders/${order.id}/status`,
    order,
  );
  const { user, dialog } = await openEdit();
  const [status] = within(dialog).getAllByRole("combobox");
  await pickStatus(user, status, "Confirmed");
  await user.click(within(dialog).getByRole("button", { name: "OK" }));
  await screen.findByText("Order updated successfully");
  expect(captured.calls[0].body).toEqual({ status: "CONFIRMED" });
});

it("[CO-DP-032] collecting more than the customer owes is refused before sending", async () => {
  const captured = captureRequests(
    "patch",
    `${endpoints.getSales}/online-orders/${order.id}/status`,
    order,
  );
  const { user, dialog } = await openEdit();
  const [, partnerSelect] = within(dialog).getAllByRole("combobox");
  await selectAntdOption(user, partnerSelect, partner.name);
  const cash = within(dialog).getByLabelText("Cash to collect");
  await user.clear(cash);
  await user.type(cash, String(owedByCustomer(order) + 100));
  await user.click(within(dialog).getByRole("button", { name: "OK" }));
  await screen.findByText(/The customer owes/);
  expect(captured.calls).toHaveLength(0);
});

it("[CO-DP-033] the online delivery slip opens in the PDF preview instead of downloading", async () => {
  const requested: URL[] = [];
  server.use(
    http.get(`${API}/consumer/sales/receipt/${order.id}`, ({ request }) => {
      requested.push(new URL(request.url));
      return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
        headers: { "content-type": "application/pdf" },
      });
    }),
  );
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
  const view = renderWithProviders(<OnlineOrders />);
  const cell = await view.findAllByText(order.sale_number);
  await view.user.click(
    within(cell[0].closest("tr")!).getByRole("button", {
      name: /Online Delivery Slip/,
    }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(`Online Delivery Slip - ${order.sale_number}`),
  ).toBeInTheDocument();
  await waitFor(() => expect(requested).toHaveLength(1));
  expect(requested[0].searchParams.get("type")).toBe("online_delivery_slip");
  expect(click).not.toHaveBeenCalled();
});
