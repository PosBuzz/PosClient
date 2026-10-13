import { screen, within } from "@testing-library/react";
import { http } from "msw";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { responseContract } from "../../../test/contracts/load";
import { expectRequestContract } from "../../../test/contracts/record";
import { API, ok } from "../../../test/msw/api";
import { server } from "../../../test/msw/server";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[AD-FLOW-PLAN-001] creates a plan with the complete backend permission choice set", async () => {
  const errors = vi.spyOn(console, "error");
  const permissions = responseContract<any[]>("admin-plan-permissions");
  server.use(
    http.get(`${API}${endpoints.plan}/permissions`, () => ok(permissions)),
  );
  const created = captureRequests("post", endpoints.plan);
  const { user } = renderWithProviders(<Page />);
  await screen.findByText("Plan 1");
  await user.click(screen.getByRole("button", { name: /Add New/ }));
  await user.type(screen.getByLabelText("Name"), "Flow Plan");
  await user.type(screen.getByLabelText("Price"), "1200");
  await user.click(screen.getByRole("combobox", { name: "Permissions" }));
  const choices = [
    ...document.querySelectorAll(".ant-select-item-option-content"),
  ].map((e) => e.textContent);
  expect(choices.sort()).toEqual(permissions.map((p) => p.action).sort());
  await user.click(await screen.findByTitle("sales"));
  await user.click(await screen.findByTitle("profile"));
  await user.click(screen.getByLabelText("Name"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Saved Successfully");
  expect(created.calls).toHaveLength(1);
  expectRequestContract("admin-plan-create", {
    method: "POST",
    path: endpoints.plan,
    auth: "admin",
    body: created.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
});

it("[AD-FLOW-PLAN-002] edits a plan and removes one permission", async () => {
  const errors = vi.spyOn(console, "error");
  const permissions = responseContract<any[]>("admin-plan-permissions");
  server.use(
    http.get(`${API}${endpoints.plan}/permissions`, () => ok(permissions)),
  );
  const plan = responseContract<any[]>("admin-plans")[0];
  const updated = captureRequests("patch", `${endpoints.plan}/${plan.id}`);
  const { user } = renderWithProviders(<Page />);
  const row = (await screen.findByText(plan.name)).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "edit" }));
  const selected = document.querySelectorAll(
    ".ant-select-selection-item-remove",
  );
  await user.click(selected[0] as HTMLElement);
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText("Updated Successfully");
  expect(updated.calls).toHaveLength(1);
  expect(updated.calls[0].body.permission_ids).toEqual(
    plan.permissions.slice(1).map((p: any) => p.permission_id),
  );
  expectRequestContract("admin-plan-update", {
    method: "PATCH",
    path: `${endpoints.plan}/${plan.id}`,
    auth: "admin",
    body: updated.calls[0].body,
  });
  expect(errors).not.toHaveBeenCalled();
});
