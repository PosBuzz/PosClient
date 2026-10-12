import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import UserStats from "../index";

it("[CO-FLOW-STATS-001] renders user sales, refunds, net sales and transaction counts from the contract", async () => {
  const data = responseContract<any[]>("user-sales-stats");
  server.use(
    http.get(`${API}${endpoints.getUserSalesStats}`, () => ok(data)),
    http.get(`${API}${endpoints.getBranchOptions}`, () => ok([])),
  );
  renderWithProviders(<UserStats />);
  for (const user of data) {
    const row = (await screen.findByText(user.name)).closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent(user.totalSales.toFixed(2));
    expect(cells[2]).toHaveTextContent(
      user.totalRefunds ? user.totalRefunds.toFixed(2) : "—",
    );
    expect(cells[3]).toHaveTextContent(user.netSales.toFixed(2));
    expect(cells[4]).toHaveTextContent(String(user.salesCount));
  }
});
