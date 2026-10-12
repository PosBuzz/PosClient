import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-view-customer] renders the customer summary and recent sales from the backend", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("customer-summary");
  const id = data.customer.id;
  server.use(
    http.get(`${API}${endpoints.getCustomerSummary(id)}`, () => ok(data)),
  );
  renderWithProviders(<Page />, {
    route: `/customers/view/${id}`,
    path: "/customers/view/:id",
  });
  expect(
    (await screen.findAllByText(data.customer.name)).length,
  ).toBeGreaterThan(0);
  for (const sale of data.recent_sales) {
    expect(screen.getByText(sale.sale_number)).toBeInTheDocument();
  }
  expect(errors).not.toHaveBeenCalled();
});
