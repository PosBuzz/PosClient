import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-barcode-printing] uses the authenticated shop name and sends a barcode label to the local agent", async () => {
  const errors = vi.spyOn(console, "error");
  const products = responseContract<any>("products-list");
  let data = { ...products, data: [] };
  const printed: any[] = [];
  server.use(
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.products}`, () => ok(data)),
    http.post(
      "http://localhost:8080/print-barcode-label",
      async ({ request }) => {
        printed.push(await request.json());
        return ok({});
      },
    ),
  );
  const { user, queryClient } = renderWithProviders(<Page />);
  expect(screen.getByLabelText("Shop Name")).toHaveValue("Shop 1");
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  data = products;
  await queryClient.invalidateQueries();
  const picker = screen.getByText("Search and select a product...").closest(".ant-select")!;
  await user.click(within(picker as HTMLElement).getByRole("combobox"));
  const variant = products.data.find((p: any) => p.name === "Product 5").variants[0];
  await user.click(await screen.findByText(/Product 5 - Default.*Barcode:/));
  const barcode = screen.getByPlaceholderText("Enter barcode number (e.g., 1234567890123)") as HTMLInputElement;
  expect(barcode).toHaveValue(variant.barcode);
  await user.type(barcode, "1234567890123", { initialSelectionStart: 0, initialSelectionEnd: barcode.value.length });
  await user.click(screen.getByRole("button", { name: /Print Label/ }));
  await screen.findByText("Barcode label printed successfully!");
  expect(printed).toHaveLength(1);
  expect(printed[0]).toMatchObject({
    BarcodeValue: "1234567890123",
    Quantity: 1,
    ShopName: "Shop 1",
  });
  expect(errors).not.toHaveBeenCalled();
});
