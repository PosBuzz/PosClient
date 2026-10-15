import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-inventory-movement-history] renders empty and populated stock movement history", async () => {
  const errors = vi.spyOn(console, "error");
  const stock = responseContract<any>("variant-stock");
  const data = responseContract<any>("movement-history");
  let body = { ...data, data: [] };
  server.use(
    http.get(
      `${API}${endpoints.inventoryMovementHistory(stock.variant.id)}`,
      () => ok(body),
    ),
    http.get(`${API}${endpoints.inventoryVariantStock(stock.variant.id)}`, () =>
      ok(stock),
    ),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
  );
  const { queryClient } = renderWithProviders(<Page />, {
    route: `/inventory/movements/${stock.variant.id}`,
    path: "/inventory/movements/:variantId",
  });
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  body = data;
  await queryClient.invalidateQueries();
  expect(
    (await screen.findAllByText("Stock Count Correction")).length,
  ).toBeGreaterThan(0);
  expect(errors).not.toHaveBeenCalled();
});
