import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import VariantStats from "../index";

it("[CO-FLOW-STATS-002] renders variant quantities, sales, refunds and net amounts from the contract", async () => {
  const data = responseContract<any>("variant-sales-stats");
  server.use(
    http.get(`${API}${endpoints.getVariantSalesStats}`, () => ok(data)),
    http.get(`${API}${endpoints.getBranchOptions}`, () => ok([])),
  );
  renderWithProviders(<VariantStats />);
  for (const variant of data.data) {
    const row = (await screen.findByText(variant.product_name)).closest("tr")!;
    expect(row).toHaveTextContent(variant.sku);
    for (const key of ["total_amount", "net_amount"]) {
      expect(row).toHaveTextContent(variant[key].toFixed(2));
    }
    if (variant.returned_amount) {
      expect(row).toHaveTextContent(variant.returned_amount.toFixed(2));
    }
  }
});
