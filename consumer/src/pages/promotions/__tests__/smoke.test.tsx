import { endpoints } from "../../../api/endpoints";
import { listPageSmoke } from "../../../test/list-page-smoke";
import Page from "../index";
import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
listPageSmoke({
  id: "promotions",
  page: <Page />,
  path: endpoints.getPromotions,
  contract: "promotions-list",
  rowLabel: (r) => r.name,
  dependencies: {},
});

it("[CO-SMOKE-promotions-create] creates a product promotion from the primary drawer action", async () => {
  const errors = vi.spyOn(console, "error");
  server.use(
    http.get(`${API}${endpoints.getPromotions}`, () =>
      ok(responseContract("promotions-list")),
    ),
    http.get(`${API}${endpoints.promotionOptions}`, () =>
      ok(responseContract("promotion-options")),
    ),
  );
  const created = captureRequests("post", endpoints.createPromotion);
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add Promotion/ }));
  await user.type(
    await screen.findByLabelText("Promotion Name"),
    "C4 promotion",
  );
  await user.type(screen.getByLabelText("Discount Value"), "10");
  await user.type(screen.getByLabelText("Start Date"), "2026-03-14{Enter}");
  await user.click(screen.getByLabelText("Variant"));
  await user.click(await screen.findByTitle(/Product 5 - Default/));
  await user.click(screen.getByRole("button", { name: /Create Promotion/ }));
  await screen.findByText("Promotion created successfully");
  expect(created.calls).toHaveLength(1);
  expect(created.calls[0].body).toMatchObject({
    name: "C4 promotion",
    scope: "SINGLE_PRODUCT",
    discount_type: "percentage",
    discount_value: 10,
    variant_ids: [1],
  });
  expect(errors).not.toHaveBeenCalled();
});
