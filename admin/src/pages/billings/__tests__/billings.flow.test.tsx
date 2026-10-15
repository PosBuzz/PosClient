import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, fail, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import { selectAntdOption } from "../../../test/antd";
import Page from "../index";

it("[AD-FLOW-BILL-001] creates a billing entry with its consumer plan and dates", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-14T12:00:00Z"));
  const errors = vi.spyOn(console, "error");
  const consumer = responseContract<any[]>("admin-consumers")[0];
  server.use(
    http.get(`${API}${endpoints.billing}`, () =>
      ok(responseContract("admin-billings")),
    ),
  );
  const created = captureRequests("post", endpoints.billing);
  const { user, queryClient } = renderWithProviders(<Page />);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await user.click(screen.getByRole("button", { name: /Add Bill/ }));
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Consumer" }),
    `${consumer.company_name} (${consumer.plan.name})`,
  );
  await user.type(screen.getByLabelText("Reference"), "Flow billing");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved Successfully");
  expect(created.calls).toHaveLength(1);
  expect(
    new Date(created.calls[0].body.billing_from).getTime(),
  ).toBeGreaterThan(new Date(consumer.latest_billing_till).getTime());
  expect(created.calls[0].body).toMatchObject({
    consumer_id: consumer.id,
    plan_id: consumer.plan.id,
    amount: Number(consumer.plan.price),
    reference: "Flow billing",
  });
  expectRequestContract("admin-billing-create", {
    method: "POST",
    path: endpoints.billing,
    auth: "admin",
    body: created.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it("[AD-ERR-022] a billing entry refused by the server shows its message", async () => {
  const message = "This billing period overlaps an existing bill.";
  const consumer = responseContract<any[]>("admin-consumers")[0];
  server.use(
    http.get(`${API}${endpoints.billing}`, () =>
      ok(responseContract("admin-billings")),
    ),
  );
  captureRequests("post", endpoints.billing, () => fail(400, message));
  const { user, queryClient } = renderWithProviders(<Page />);
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await user.click(screen.getByRole("button", { name: /Add Bill/ }));
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Consumer" }),
    `${consumer.company_name} (${consumer.plan.name})`,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
