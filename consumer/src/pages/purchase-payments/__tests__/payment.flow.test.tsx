import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import PurchasePayments from "../index";
import MakePurchasePayment from "../make-payment";

const fixture = responseContract<any>("purchase-payment-batches");
const soldOutBatch = (status: "due" | "partial") => ({
  ...fixture.data[0],
  quantity: 0,
  total_cost: 480,
  paid_amount: status === "due" ? 0 : 200,
  remaining_amount: status === "due" ? 480 : 280,
  payment_status: status,
});

it("[CO-PPAY-001] sold-out due and partial batches keep Pay while settled and empty balances show View", async () => {
  const rows = [
    soldOutBatch("due"),
    soldOutBatch("partial"),
    { ...soldOutBatch("partial"), payment_status: "paid", remaining_amount: 0 },
    { ...soldOutBatch("due"), total_cost: 0, remaining_amount: 0 },
    { ...soldOutBatch("partial"), quantity: 5 },
  ].map((batch, i) => ({ ...batch, id: i + 1, batch_number: `PAY-${i + 1}` }));
  server.use(
    http.get(`${API}${endpoints.getPurchasePaymentBatches}`, () =>
      ok({ ...fixture, data: rows }),
    ),
  );
  renderWithProviders(<PurchasePayments />);
  for (const [i, label] of ["Pay", "Pay", "View", "View", "Pay"].entries()) {
    const row = (await screen.findByText(`PAY-${i + 1}`)).closest("tr")!;
    expect(within(row).getByRole("link", { name: label })).toHaveAttribute(
      "href",
      `/purchase-payments/${i + 1}`,
    );
  }
});

it.each(["due", "partial"] as const)(
  "[CO-PPAY-002-%s] records the outstanding balance of a sold-out batch",
  async (status) => {
    const batch = soldOutBatch(status);
    server.use(
      http.get(`${API}${endpoints.getBatchForPayment(batch.id)}`, () =>
        ok(batch),
      ),
    );
    const captured = captureRequests("post", endpoints.makePurchasePayment);
    const { user } = renderWithProviders(<MakePurchasePayment />, {
      route: `/purchase-payments/${batch.id}`,
      path: "/purchase-payments/:id",
    });
    expect(await screen.findByPlaceholderText("0.00")).toHaveValue(
      batch.remaining_amount.toFixed(2),
    );
    await user.click(screen.getByRole("button", { name: /Record Payment/ }));
    await screen.findByText("Payment recorded successfully!");
    expect(captured.calls).toHaveLength(1);
    expect(captured.calls[0].body).toEqual({
      batch_id: batch.id,
      payments: [
        {
          payment_method: "CASH",
          amount: batch.remaining_amount,
          reference: "",
        },
      ],
    });
  },
);

it("[CO-PPAY-003] a settled sold-out batch stays read-only", async () => {
  const batch = {
    ...soldOutBatch("partial"),
    payment_status: "paid",
    paid_amount: 480,
    remaining_amount: 0,
  };
  server.use(
    http.get(`${API}${endpoints.getBatchForPayment(batch.id)}`, () =>
      ok(batch),
    ),
  );
  renderWithProviders(<MakePurchasePayment />, {
    route: `/purchase-payments/${batch.id}`,
    path: "/purchase-payments/:id",
  });
  await screen.findByText(/This batch has no outstanding balance/);
  expect(
    screen.queryByRole("button", { name: /Record Payment/ }),
  ).not.toBeInTheDocument();
});
