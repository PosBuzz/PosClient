import { screen } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import { selectAntdOption } from "../../../test/antd";
import Page from "../index";

it("[AD-FLOW-ROLE-001] creates a role with selected admin permissions", async () => {
  const errors = vi.spyOn(console, "error");
  server.use(
    http.get(`${API}${endpoints.role}`, () =>
      ok(responseContract("admin-roles")),
    ),
    http.get(`${API}${endpoints.adminPermission}`, () =>
      ok(responseContract("admin-permissions")),
    ),
  );
  const created = captureRequests("post", endpoints.role);
  const { user } = renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  await user.type(screen.getByLabelText("Name"), "Flow Admin Role");
  await selectAntdOption(
    user,
    screen.getByRole("combobox", { name: "Permissions" }),
    "plans",
  );
  await user.click(screen.getByLabelText("Name"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved Successfully");
  expect(created.calls).toHaveLength(1);
  expectRequestContract("admin-role-create", {
    method: "POST",
    path: endpoints.role,
    auth: "admin",
    body: created.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
});
