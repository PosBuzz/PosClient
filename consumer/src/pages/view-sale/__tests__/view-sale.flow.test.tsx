import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import ViewSale from "../index";

it("[CO-FLOW-VS-001] renders net line totals, discounts, payments and return history from the backend", async () => {
  const sale = responseContract<any>("sale-detail");
  server.use(http.get(`${API}${endpoints.getSale(sale.id)}`, () => ok(sale)));
  renderWithProviders(<ViewSale />, {
    route: `/sales/view/${sale.id}`,
    path: "/sales/view/:id",
  });
  await screen.findByText(`Sale #${sale.sale_number}`);
  for (const item of sale.items) {
    const row = screen
      .getAllByRole("row")
      .find((row) => row.textContent?.includes(item.variant.product.name))!;
    const cells = within(row).getAllByRole("cell");
    // line_total is already net of discounts (KI-047); subtracting them again is a regression.
    expect(cells[cells.length - 1]?.textContent).toContain(
      Number(item.line_total).toFixed(2),
    );
    for (const key of [
      "average_discount_amount",
      "special_discount_amount",
      "promotion_discount_amount",
    ]) {
      expect(row.textContent).toContain(Number(item[key]).toFixed(2));
    }
  }
  for (const payment of sale.payments)
    {expect(screen.getAllByText(payment.payment_method).length).toBeGreaterThan(
      0,
    );}
  for (const ret of sale.returns)
    {expect(screen.getByText(ret.return_number)).toBeInTheDocument();}
});
