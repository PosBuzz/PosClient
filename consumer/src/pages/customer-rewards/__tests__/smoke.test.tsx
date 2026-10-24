import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-customer-rewards] renders empty and populated rewards then redeems a customer's points", async () => {
  const errors = vi.spyOn(console, "error");
  const data = responseContract<any>("customers-with-points");
  let body = { ...data, data: [] };
  server.use(
    http.get(`${API}${endpoints.getCustomersWithPoints}`, () => ok(body)),
  );
  const customer = data.data[0];
  const redeemed = captureRequests(
    "post",
    endpoints.redeemCustomerPoints(customer.customer_id),
  );
  const empty = renderWithProviders(<Page />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  empty.unmount();
  body = data;
  const { user } = renderWithProviders(<Page />);
  const row = (await screen.findByText(customer.customer.name)).closest("tr")!;
  await user.click(
    within(row).getByRole("img", { name: "minus" }).closest("button")!,
  );
  await user.type(
    await screen.findByPlaceholderText("Enter points to redeem"),
    "100",
  );
  await user.click(screen.getByRole("button", { name: "Redeem Points" }));
  await screen.findByText("Points redeemed successfully");
  expect(redeemed.calls).toHaveLength(1);
  expect(redeemed.calls[0].body).toMatchObject({ points: 100 });
  expect(errors).not.toHaveBeenCalled();
});

it("[CO-REWARD-001] asking to redeem more points than the customer has shows the limit and sends nothing, instead of redeeming everything", async () => {
  const data = responseContract<any>("customers-with-points");
  server.use(
    http.get(`${API}${endpoints.getCustomersWithPoints}`, () => ok(data)),
  );
  const customer = data.data[0];
  const redeemed = captureRequests(
    "post",
    endpoints.redeemCustomerPoints(customer.customer_id),
  );
  const { user } = renderWithProviders(<Page />);
  const row = (await screen.findByText(customer.customer.name)).closest("tr")!;
  await user.click(
    within(row).getByRole("img", { name: "minus" }).closest("button")!,
  );
  await user.type(
    await screen.findByPlaceholderText("Enter points to redeem"),
    String(customer.total_points + 5000),
  );
  await user.click(screen.getByRole("button", { name: "Redeem Points" }));
  await screen.findByText(`Must be between 1 and ${customer.total_points}`);
  expect(redeemed.calls).toHaveLength(0);
});
