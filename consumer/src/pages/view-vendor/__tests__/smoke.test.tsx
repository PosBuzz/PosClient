import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-view-vendor] renders a vendor with empty and populated purchase history", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("vendor-detail");
  let body = { ...data, batches: [], allPayments: [] };
  server.use(
    http.get(`${API}${endpoints.getVendorDetails(data.vendor.id)}`, () =>
      ok(body),
    ),
  );
  const { queryClient } = renderWithProviders(<Page />, {
    route: `/vendors/view/${data.vendor.id}`,
    path: "/vendors/view/:id",
  });
  await screen.findAllByText("No data", { selector: ".ant-empty-description" });
  body = data;
  await queryClient.invalidateQueries();
  expect(
    await screen.findByText(data.batches[0].batch_number),
  ).toBeInTheDocument();
  expect(screen.getAllByText(data.vendor.name).length).toBeGreaterThan(0);
  expect(errors).not.toHaveBeenCalled();
});
