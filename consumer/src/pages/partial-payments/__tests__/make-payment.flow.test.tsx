import { screen } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { queryKeys } from "../../../constants/queryKeys";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import MakePayment from "../make-payment";

const sale = responseContract<any>("partial-payments").data[0];
beforeEach(() => {
  server.use(
    http.get(`${API}${endpoints.getSaleForPayment(sale.id)}`, () => ok(sale)),
  );
});
const mount = () =>
  renderWithProviders(<MakePayment />, {
    route: `/partial-payments/make-payment/${sale.id}`,
    path: "/partial-payments/make-payment/:id",
  });

it("[CO-FLOW-PAY-001] pays the remaining balance with the recorded request", async () => {
  const captured = captureRequests("post", endpoints.makePayment);
  const { user } = mount();
  const input = await screen.findByPlaceholderText("0.00");
  expect(input).toHaveValue(sale.remaining_amount.toFixed(2));
  await user.click(screen.getByRole("button", { name: /Record Payment/ }));
  await screen.findByText("Payment recorded successfully!");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toEqual({
    sale_id: sale.id,
    payments: [
      { payment_method: "CASH", amount: sale.remaining_amount, reference: "" },
    ],
  });
  expectRequestContract("make-payment", {
    method: "POST",
    path: endpoints.makePayment,
    auth: "client",
    body: captured.calls[0].body,
  });
});

it("[CO-FLOW-PAY-002] blocks an overpayment before sending a request", async () => {
  const captured = captureRequests("post", endpoints.makePayment);
  const { user } = mount();
  const input = (await screen.findByPlaceholderText(
    "0.00",
  )) as HTMLInputElement;
  await user.type(input, "999", {
    initialSelectionStart: 0,
    initialSelectionEnd: input.value.length,
  });
  await user.click(screen.getByRole("button", { name: /Record Payment/ }));
  await screen.findByText(/exceeds remaining amount/);
  expect(captured.calls).toHaveLength(0);
});

it("[CO-FLOW-PAY-003] a successful payment refreshes sales and every report", async () => {
  const captured = captureRequests("post", endpoints.makePayment);
  const { user, queryClient } = mount();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  await screen.findByPlaceholderText("0.00");
  await user.click(screen.getByRole("button", { name: /Record Payment/ }));
  await screen.findByText("Payment recorded successfully!");
  expect(captured.calls).toHaveLength(1);
  const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
  for (const key of [
    queryKeys.partialPayments,
    queryKeys.sales,
    queryKeys.dashboardAnalytics,
    queryKeys.eod,
    queryKeys.userSalesStats,
    queryKeys.variantSalesStats,
  ]) {
    expect(keys).toContain(key);
  }
});
