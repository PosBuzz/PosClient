import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Costs from "../index";

it("[CO-SMOKE-operational-costs] renders empty and populated costs and saves a new cost", async () => {
  const errors = vi.spyOn(console, "error");
  let rows: any[] = [];
  server.use(http.get(`${API}${endpoints.operationalCosts}`, () => ok(rows)));
  const captured = captureRequests("post", endpoints.operationalCosts);
  const { user, queryClient } = renderWithProviders(<Costs />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  rows = [{ id: 31, name: "Rent", amount: 300, incurred_on: "2026-03-14" }];
  await queryClient.invalidateQueries();
  await screen.findByText("Rent");
  await user.click(screen.getByRole("button", { name: /Declare cost/ }));
  await user.type(await screen.findByLabelText("Cost name"), "Transport");
  await user.type(screen.getByLabelText("Amount"), "25");
  await user.click(screen.getByRole("button", { name: /Save cost/ }));
  await screen.findByText("Operational cost saved");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    name: "Transport",
    amount: 25,
  });
  expect(errors).not.toHaveBeenCalled();
});
