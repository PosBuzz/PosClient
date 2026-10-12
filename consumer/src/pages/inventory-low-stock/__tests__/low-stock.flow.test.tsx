import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import LowStock from "../index";

it("[CO-FLOW-INV-004] renders low stock product, threshold, stock and branch from the contract", async () => {
  const data = responseContract<any[]>("low-stock");
  server.use(
    http.get(`${API}${endpoints.inventoryLowStock}`, () => ok(data)),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  renderWithProviders(<LowStock />);
  for (const item of data) {
    const row = (await screen.findByText(item.product.name)).closest("tr")!;
    expect(row).toHaveTextContent(item.sku);
    expect(row).toHaveTextContent(item.affected_branch_name);
    expect(row).toHaveTextContent(String(item.total_stock));
    expect(row).toHaveTextContent(String(item.alert_quantity));
  }
});
