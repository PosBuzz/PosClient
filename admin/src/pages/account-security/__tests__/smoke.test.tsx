import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import Page from "../index";

it("[AD-SMOKE-account-security] shows the authenticated account and changes its password", async () => {
  const errors = vi.spyOn(console, "error");
  const changed = captureRequests("patch", endpoints.changePassword);
  const { user } = renderWithProviders(<Page />);
  expect(screen.getByText(/Super Admin/)).toBeVisible();
  await user.type(screen.getByLabelText("Old Password"), "PosBuzz!234");
  await user.type(screen.getByLabelText("New Password"), "NewPassword!234");
  await user.type(screen.getByLabelText("Confirm Password"), "NewPassword!234");
  await user.click(screen.getByRole("button", { name: /Change Password/ }));
  await screen.findByText("Password changed successfully!");
  expect(changed.calls).toHaveLength(1);
  expect(changed.calls[0].body).toMatchObject({
    old_password: "PosBuzz!234",
    new_password: "NewPassword!234",
  });
  expect(errors).not.toHaveBeenCalled();
});
