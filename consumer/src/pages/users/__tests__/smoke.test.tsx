import { screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { API, ok } from "../../../test/msw/api";
import { captureRequests } from "../../../test/msw/capture";
import { server } from "../../../test/msw/server";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[CO-SMOKE-users] renders empty and populated users and creates a user with a selected role", async () => {
  const errors = vi.spyOn(console, "error");
  let rows: any[] = [];
  server.use(
    http.get(`${API}${endpoints.user}`, () => ok(rows)),
    http.get(`${API}${endpoints.role}`, () =>
      ok([
        { id: 31, name: "Cashier" },
        { id: 33, name: "Stock keeper" },
      ]),
    ),
    http.get(`${API}${endpoints.getBranchOptions}`, () =>
      ok([{ id: 1, name: "Branch 1" }]),
    ),
  );
  const captured = captureRequests("post", endpoints.user);
  const { user, queryClient } = renderWithProviders(<Page />);
  await screen.findByText("No data", { selector: ".ant-empty-description" });
  rows = [
    {
      id: 32,
      name: "Existing cashier",
      email: "cashier@example.test",
      role: { name: "Cashier" },
      branches: [],
    },
  ];
  await queryClient.invalidateQueries();
  await screen.findByText("Existing cashier");
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  await user.type(await screen.findByLabelText("Name"), "New cashier");
  await user.type(screen.getByLabelText("Email"), "new-cashier@example.test");
  await user.type(screen.getByLabelText("Password"), "safe-password-123");
  await user.click(screen.getByLabelText("Role"));
  await user.click(await screen.findByTitle("Cashier"));
  await user.click(screen.getByLabelText("Branch Access"));
  await user.click(await screen.findByTitle("Branch 1"));
  await user.click(screen.getByLabelText("Role"));
  await user.click(await screen.findByTitle("Stock keeper"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(captured.calls).toHaveLength(1));
  expect(captured.calls[0].body).toMatchObject({
    name: "New cashier",
    email: "new-cashier@example.test",
    role_id: 33,
    branch_ids: [],
  });
  expect(errors).not.toHaveBeenCalled();
});
