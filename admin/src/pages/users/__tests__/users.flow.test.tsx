import { screen } from "@testing-library/react";
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

it("[AD-FLOW-USER-001] creates an admin user with the chosen role", async () => {
  const errors = vi.spyOn(console, "error");
  const roles = responseContract<any[]>("admin-roles");
  server.use(
    http.get(`${API}${endpoints.user}`, () =>
      ok(responseContract("admin-users")),
    ),
    http.get(`${API}${endpoints.role}`, () => ok(roles)),
  );
  const created = captureRequests("post", endpoints.user);
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  for (const [label, value] of Object.entries({
    Name: "Flow Admin",
    Email: "newadmin@example.test",
    Password: "PosBuzz!234",
  })) {
    await user.type(screen.getByLabelText(label), value);
  }
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Role" }),
    roles[0].name,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved Successfully");
  expect(created.calls).toHaveLength(1);
  expectRequestContract("admin-user-create", {
    method: "POST",
    path: endpoints.user,
    auth: "admin",
    body: created.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
});

it("[AD-ERR-023] a duplicate email refused by the server shows its message", async () => {
  const message = "A user with this email already exists.";
  const roles = responseContract<any[]>("admin-roles");
  server.use(
    http.get(`${API}${endpoints.user}`, () =>
      ok(responseContract("admin-users")),
    ),
    http.get(`${API}${endpoints.role}`, () => ok(roles)),
  );
  captureRequests("post", endpoints.user, () => fail(409, message));
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  for (const [label, value] of Object.entries({
    Name: "Flow Admin",
    Email: "newadmin@example.test",
    Password: "PosBuzz!234",
  })) {
    await user.type(screen.getByLabelText(label), value);
  }
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Role" }),
    roles[0].name,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText(message)).toBeInTheDocument();
});
