import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-roles] renders empty and populated roles and creates a role with a plan permission", async () => {
  const errors = vi.spyOn(console, "error");
  let rows: any[] = [];
  server.use(
    http.get(`${API}${endpoints.role}`, () => ok(rows)),
    http.get(`${API}${endpoints.planPermissions}`, () =>
      ok(responseContract("plan-permissions")),
    ),
  );
  const captured = captureRequests("post", endpoints.role);
  const { user, queryClient } = renderWithProviders(<Page />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  rows = [{ id: 31, name: "Cashier", permissions: [] }];
  await queryClient.invalidateQueries();
  await screen.findByText("Cashier");
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  await user.type(await screen.findByLabelText("Name"), "Stock keeper");
  await user.click(screen.getByLabelText("Permissions"));
  await user.type(screen.getByLabelText("Permissions"), "inventory_batches");
  const options = await screen.findAllByText("Inventory");
  const option = options.find((node) => node.closest(".ant-select-dropdown"))!;
  await user.click(option);
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(captured.calls).toHaveLength(1));
  expect(captured.calls[0].body).toMatchObject({
    name: "Stock keeper",
    permission_ids: [10],
  });
  expect(errors).not.toHaveBeenCalled();
});
