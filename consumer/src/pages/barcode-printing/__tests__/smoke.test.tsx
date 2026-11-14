import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";
import { printLabelDocument } from "../label-layout";
vi.mock("../label-layout", async (original) => ({
  ...(await original<typeof import("../label-layout")>()),
  printLabelDocument: vi.fn().mockResolvedValue(undefined),
}));

it("[CO-SMOKE-barcode-printing] uses the authenticated shop name and prints barcode labels through the browser", async () => {
  const errors = vi.spyOn(console, "error");
  const products = structuredClone(responseContract<any>("products-list"));
  products.data.find((product: any) => product.name === "Product 5").tax = 0;

  server.use(
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.products}`, () => ok(products)),
  );
  const { user, queryClient } = renderWithProviders(<Page />);
  expect(screen.getByLabelText("Shop Name")).toHaveValue("Shop 1");
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const picker = screen
    .getByText("Search and select a product...")
    .closest(".ant-select")!;
  await user.click(within(picker as HTMLElement).getByRole("combobox"));
  const variant = products.data.find((p: any) => p.name === "Product 5")
    .variants[0];
  await user.click(await screen.findByText(/Product 5 - Default.*Barcode:/));
  expect(screen.getByLabelText("VAT Percentage")).toHaveValue("0.0");
  const barcode = screen.getByPlaceholderText(
    "Enter barcode number (e.g., 1234567890123)",
  ) as HTMLInputElement;
  expect(barcode).toHaveValue(variant.barcode);
  await user.clear(barcode);
  await user.paste("1234567890123");
  await user.click(screen.getByRole("button", { name: /Print Label/ }));
  await waitFor(() => expect(printLabelDocument).toHaveBeenCalledTimes(1));
  const html = vi.mocked(printLabelDocument).mock.calls[0][0];
  expect(html).toContain("Shop 1");
  expect(html).toContain("1234567890123");
  expect(html).toContain("@page{size:50mm 30mm");
  expect(html).not.toContain("VAT 21%");
  expect(html).not.toContain("localhost:8080");
  expect(errors).not.toHaveBeenCalled();
});

it("[CO-LABEL-010] the barcode drawing keeps a valid viewBox for EAN-13, so the bars scale into the label instead of running off its edge", async () => {
  const products = structuredClone(responseContract<any>("products-list"));
  server.use(
    http.get(`${API}${endpoints.getBranches}`, () =>
      ok(responseContract("branches")),
    ),
    http.get(`${API}${endpoints.products}`, () => ok(products)),
  );
  vi.mocked(printLabelDocument).mockClear();
  const { user, queryClient } = renderWithProviders(<Page />);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  const barcode = screen.getByPlaceholderText(
    "Enter barcode number (e.g., 1234567890123)",
  );
  await user.clear(barcode);
  await user.paste("1230831887214");
  const format = screen.getByText("CODE128").closest(".ant-select")!;
  await user.click(within(format as HTMLElement).getByRole("combobox"));
  await user.click(await screen.findByTitle("EAN13"));
  await user.click(screen.getByRole("button", { name: /Print Label/ }));
  await waitFor(() => expect(printLabelDocument).toHaveBeenCalledTimes(1));
  const html = vi.mocked(printLabelDocument).mock.calls[0][0];
  const viewBox = html.match(/viewBox="([^"]*)"/)?.[1];
  expect(viewBox).toMatch(/^0 0 [\d.]+ [\d.]+$/);
});
