import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-inventory-variant-stock] renders empty and stocked batches for a variant", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("variant-stock");
  let body = { ...data, batches: [], stock_by_branch: {}, total_stock: 0 };
  server.use(
    http.get(`${API}${endpoints.inventoryVariantStock(data.variant.id)}`, () =>
      ok(body),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  const { queryClient } = renderWithProviders(<Page />, {
    route: `/inventory/variants/${data.variant.id}`,
    path: "/inventory/variants/:id",
  });
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  body = data;
  await queryClient.invalidateQueries();
  expect(
    await screen.findByText(data.batches[0].batch_number),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText(data.variant.product.name, { exact: false }).length,
  ).toBeGreaterThan(0);
  expect(errors).not.toHaveBeenCalled();
});
