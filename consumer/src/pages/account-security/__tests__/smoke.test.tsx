import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import Security from "../index";

it("[CO-SMOKE-account-security] renders the account and changes its password through the primary action", async () => {
  const errors = vi.spyOn(console, "error");
  const captured = captureRequests("patch", endpoints.changePassword);
  const { user } = renderWithProviders(<Security />);
  expect(
    screen.getByText("admin1@example.test", { exact: false }),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText("Old Password"), "old-password");
  await user.type(screen.getByLabelText("New Password"), "new-password-123");
  await user.type(
    screen.getByLabelText("Confirm Password"),
    "new-password-123",
  );
  await user.click(screen.getByRole("button", { name: /Change Password/ }));
  await screen.findByText("Password changed successfully!");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    old_password: "old-password",
    new_password: "new-password-123",
  });
  expect(errors).not.toHaveBeenCalled();
});
