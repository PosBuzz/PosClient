import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Settings from "../index";

it("[CO-SMOKE-rewards-settings] loads the rewards policy and saves through its settings endpoint", async () => {
  const errors = vi.spyOn(console, "error");
  const settings = {
    id: 1,
    consumer_id: 1,
    is_enabled: true,
    points_per_currency: 1,
    minimum_purchase_amount: 0,
    redemption_value: 0.01,
    minimum_redemption: 100,
    allow_partial_redemption: true,
    earn_on_sale_only: true,
  };
  server.use(
    http.get(`${API}${endpoints.getRewardsSettings}`, () => ok(settings)),
  );
  const captured = captureRequests(
    "patch",
    endpoints.updateRewardsSettings,
    settings,
  );
  const { user } = renderWithProviders(<Settings />);
  const save = await screen.findByRole("button", { name: /Save Settings/ });
  await user.click(save);
  await screen.findByText("Rewards settings saved successfully");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    points_per_currency: 1,
    redemption_value: 0.01,
    minimum_redemption: 100,
  });
  expect(errors).not.toHaveBeenCalled();
});
