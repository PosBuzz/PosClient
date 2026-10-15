import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-view-product] renders the product detail contract and its edit action", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("product-detail");
  server.use(
    http.get(`${API}${endpoints.getProduct(data.id)}`, () => ok(data)),
  );
  renderWithProviders(<Page />, {
    route: `/products/view/${data.id}`,
    path: "/products/view/:id",
  });
  expect((await screen.findAllByText(data.name)).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Edit Product/ })).toBeEnabled();
  expect(errors).not.toHaveBeenCalled();
});
