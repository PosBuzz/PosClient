import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import EOD from "../index";

it("[CO-FLOW-EOD-001] renders business totals and requests the PDF with the same report parameters", async () => {
  const data = responseContract<any>("eod");
  const reports: URL[] = [];
  const pdfs: URL[] = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-report");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  server.use(
    http.get(`${API}${endpoints.getSales}/reports/eod`, ({ request }) => {
      reports.push(new URL(request.url));
      return ok(data);
    }),
    http.get(`${API}${endpoints.businessReportPdf}`, ({ request }) => {
      pdfs.push(new URL(request.url));
      return new HttpResponse("%PDF-1.4 test", {
        headers: { "Content-Type": "application/pdf" },
      });
    }),
  );
  const { user } = renderWithProviders(<EOD />);
  await screen.findByText("Gross Sales");
  for (const [title, key] of [
    ["Gross Sales", "total_amount"],
    ["Real Money Collected", "real_money_collected"],
    ["Due / Receivables", "total_due"],
    ["Net Sales", "net_sale_amount"],
    ["Cash Sales", "cash_sales"],
    ["Digital Sales (Card/MFS)", "digital_sales"],
    ["Reward Points Redeemed", "reward_point_sales"],
    ["Product Exchanges", "unique_exchanges"],
    ["Cash Refunds", "cash_refunds"],
    ["Net Cash Collections", "net_cash_sales"],
    ["Operational Costs", "operational_costs"],
    ["Net Operating Result", "net_operating_result"],
    ["Total Refunds", "total_refund"],
    ["Average Transaction", "average_transaction_value"],
  ]) {
    const titleElement = screen
      .getAllByText(title)
      .find((node) => node.closest(".ant-statistic"))!;
    expect(
      titleElement
        .closest(".ant-statistic")
        ?.querySelector(".ant-statistic-content-value")?.textContent,
    ).toBe(
      data.summary[key].toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }
  expect(
    screen.getByText(`${data.summary.total_sales} transactions`, {
      exact: false,
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`${data.summary.due_sales_count} invoice(s) with due`),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`${data.summary.unique_products_sold} unique products`),
  ).toBeInTheDocument();
  const sold = screen.getByText("Items Sold").closest(".ant-statistic")!;
  expect(sold.querySelector(".ant-statistic-content-value")?.textContent).toBe(
    String(data.summary.total_items_sold),
  );
  const refundCard = screen.getByText("Total Refunds").closest(".ant-card")!;
  expect(refundCard.textContent).toContain(
    `${data.summary.total_returns} return(s) · ${data.summary.total_items_returned} item(s)`,
  );
  expect(screen.getByText(/· Due paid:/).textContent).toContain(
    data.summary.due_collected.toFixed(2),
  );
  expect(screen.getByText(/· Disc:/).textContent).toContain(
    data.summary.total_discount.toFixed(2),
  );
  await user.click(screen.getByRole("button", { name: /Preview PDF/ }));
  await waitFor(() => expect(pdfs).toHaveLength(1));
  expect(Object.fromEntries(pdfs[0].searchParams)).toEqual(
    Object.fromEntries(reports[0].searchParams),
  );
});

it("[CO-FLOW-EOD-006] distinguishes cancelled due, credit refunds and money paid out in the return breakdown", async () => {
  const data = responseContract<any>("eod");
  data.summary = {
    ...data.summary,
    total_returns: 3,
    total_return_value: 500,
    total_refund: 225,
    total_exchange_return: 25,
    due_reduced: 250,
    cash_refunds: 100,
    digital_refunds: 50,
    credit_refunds: 75,
    shipping_refunded: 25,
  };
  server.use(
    http.get(`${API}${endpoints.getSales}/reports/eod`, () => ok(data)),
  );
  renderWithProviders(<EOD />);
  await screen.findByText("Return Value Breakdown");
  for (const [label, value] of [
    ["Total returned value", "500.00"],
    ["Due cancelled", "250.00"],
    ["Cash / digital refunded", "150.00"],
    ["Store credit refunded", "75.00"],
    ["Shipping returned (included above)", "25.00"],
  ]) {
    expect(
      screen
        .getByText(label)
        .closest(".ant-statistic")
        ?.querySelector(".ant-statistic-content-value")?.textContent,
    ).toBe(value);
  }
  expect(
    screen.getByText(/Only cash and digital refunds reduce money collected/),
  ).toBeInTheDocument();
  expect(screen.getByText(/this is not net profit/)).toBeInTheDocument();
});
