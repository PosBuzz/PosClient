import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-product-audit] selects a product variant and runs its inventory audit", async () => {
  const errors = vi.spyOn(console, "error");
  const audit = responseContract<any>("product-audit");
  const requests: URL[] = [];
  server.use(
    http.get(`${API}${endpoints.products}`, () =>
      ok(responseContract("products-list")),
    ),
    http.get(`${API}${endpoints.inventoryProductVariants(1)}`, () =>
      ok(responseContract("inventory-variants")),
    ),
    http.get(`${API}${endpoints.getBranchOptions}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.getProductAudit}`, ({ request }) => {
      requests.push(new URL(request.url));
      return ok(audit);
    }),
  );
  const { user } = renderWithProviders(<Page />);
  const select = async (placeholder: string, name: string) => {
    const wrapper = (await screen.findByText(placeholder)).closest(
      ".ant-select",
    )!;
    await user.click(within(wrapper as HTMLElement).getByRole("combobox"));
    const options = await screen.findAllByText(new RegExp(name));
    await user.click(options[options.length - 1]);
  };
  expect(screen.getByRole("button", { name: /Run Audit/ })).toBeDisabled();
  await select("Search and select product…", "Product 5");
  await select("Select variant…", "Default");
  await user.click(screen.getByRole("button", { name: /Run Audit/ }));
  expect((await screen.findAllByText(/BATCH10/)).length).toBeGreaterThan(0);
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("variant_id")).toBe("1");
  expect(errors).not.toHaveBeenCalled();
});
