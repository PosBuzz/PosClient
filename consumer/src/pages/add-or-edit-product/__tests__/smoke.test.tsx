import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-add-or-edit-product] loads a product, edits its name and saves the update", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("product-detail");
  server.use(
    http.get(`${API}${endpoints.getProduct(data.id)}`, () => ok(data)),
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.getCategories}`, () => ok([])),
    http.get(`${API}${endpoints.getBrands}`, () => ok([])),
    http.get(`${API}${endpoints.getTags}`, () => ok([])),
    http.get(`${API}${endpoints.getUnits}`, () => ok([])),
    http.get(`${API}${endpoints.getVendors}`, () => ok([])),
  );
  const captured = captureRequests(
    "patch",
    endpoints.getProduct(data.id),
    data,
  );
  const { user } = renderWithProviders(<Page />, {
    route: `/products/edit/${data.id}`,
    path: "/products/edit/:id",
  });
  const name = (await screen.findByPlaceholderText(
    "Enter product name",
  )) as HTMLInputElement;
  expect(name).toHaveValue(data.name);
  await user.type(name, "Updated product", {
    initialSelectionStart: 0,
    initialSelectionEnd: name.value.length,
  });
  await user.click(screen.getByRole("button", { name: /Update Product/ }));
  await screen.findByText(/Product updated successfully/i);
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body.name).toBe("Updated product");
  expect(errors).not.toHaveBeenCalled();
});
