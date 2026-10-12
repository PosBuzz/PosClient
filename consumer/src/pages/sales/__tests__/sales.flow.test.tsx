import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { beforeEach, expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, fail, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Sales from "../index";

const sales = responseContract<any>("sales-list");
beforeEach(() =>
  server.use(http.get(`${API}${endpoints.getSales}`, () => ok(sales))),
);

it("[CO-FLOW-SL-001] renders the sales rows and all financial summary tiles", async () => {
  renderWithProviders(<Sales />);
  for (const sale of sales.data)
    {expect(await screen.findByText(sale.sale_number)).toBeInTheDocument();}
  for (const [label, key] of [
    ["Gross Invoiced", "total_amount"],
    ["Total Received", "total_received"],
    ["Total Due", "total_due"],
    ["Refunds", "total_refund"],
    ["Net Sales", "net_amount"],
  ]) {
    const tile = screen.getByText(label).closest(".ant-statistic")!;
    expect(
      tile.querySelector(".ant-statistic-content-value")?.textContent,
    ).toBe(
      Number(sales.summary[key]).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }
});

it("[CO-FLOW-SL-002] deleting with a reason sends it and shows the backend rejection verbatim", async () => {
  const sale = sales.data[0];
  const captured = captureRequests("delete", endpoints.getSale(sale.id), () =>
    fail(400, "Sale has return(s)"),
  );
  const { user } = renderWithProviders(<Sales />);
  const row = (await screen.findByText(sale.sale_number)).closest("tr")!;
  await user.click(
    within(row).getByRole("img", { name: "delete" }).closest("button")!,
  );
  await user.type(
    await screen.findByPlaceholderText("Reason (optional)"),
    "Mistaken sale",
  );
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Delete Sale",
    }),
  );
  await screen.findByText("Sale has return(s)");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toEqual({ reason: "Mistaken sale" });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("[CO-FLOW-SL-003] restores a deleted sale after confirmation", async () => {
  const sale = sales.data[0];
  const captured = captureRequests(
    "post",
    endpoints.restoreSale(sale.id),
    sale,
  );
  const { user } = renderWithProviders(<Sales />);
  await screen.findByText(sale.sale_number);
  await user.click(screen.getByRole("tab", { name: "Deleted Sales" }));
  const row = screen.getByText(sale.sale_number).closest("tr")!;
  await user.click(
    within(row).getByRole("img", { name: "undo" }).closest("button")!,
  );
  await user.click(await screen.findByRole("button", { name: "Restore" }));
  await screen.findByText("Sale restored");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toEqual({});
});
