import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { Route, Routes } from "react-router-dom";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { Permissions } from "../../../constants/permissions";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import AddSale from "../../add-sales";
import QuotationDetail from "../index";

it("[CO-FLOW-QUO-002] converts the viewed quotation through Add sale with quotation_id", async () => {
  const quotation = responseContract<any>("quotation-detail");
  server.use(
    http.get(`${API}${endpoints.getQuotation(quotation.id)}`, () =>
      ok(quotation),
    ),
    http.get(`${API}${endpoints.getCustomers}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.user}`, () => ok({ data: [] })),
    http.get(`${API}${endpoints.getProductsForSale}`, () =>
      ok(responseContract("products-for-sale")),
    ),
    http.get(`${API}${endpoints.activePromotions}`, () => ok([])),
  );
  const created = captureRequests("post", endpoints.createSale, { id: 101 });
  const { user } = renderWithProviders(
    <Routes>
      <Route path="/quotations/view/:id" element={<QuotationDetail />} />
      <Route path="/sales/new" element={<AddSale />} />
    </Routes>,
    {
      route: `/quotations/view/${quotation.id}`,
      permissions: [Permissions.sales],
    },
  );
  const buttons = await screen.findAllByRole("button", {
    name: /Convert to Sale/,
  });
  await user.click(buttons[0]);
  const submit = await screen.findByRole("button", { name: /Create Sale/ });
  await waitFor(() =>
    expect(
      screen.getAllByText(quotation.items[0].variant.product.name, {
        exact: false,
      }).length,
    ).toBeGreaterThan(0),
  );
  await user.click(submit);
  await screen.findByText("Sale created successfully!");
  expect(created.calls).toHaveLength(1);
  expect(created.calls[0].body).toMatchObject({
    quotation_id: quotation.id,
  });
  expect(
    created.calls[0].body.items.map((item: any) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    })),
  ).toEqual(
    quotation.items.map((item: any) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    })),
  );
});
