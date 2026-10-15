import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import Profile from "../index";

it("[CO-SMOKE-profile] loads the company profile and saves changed contact information", async () => {
  const errors = vi.spyOn(console, "error");
  const captured = captureRequests("patch", endpoints.updateConsumerProfile);
  const { user } = renderWithProviders(<Profile />);
  expect(screen.getByLabelText("Company Name")).toHaveValue("Shop 1");
  await user.type(screen.getByLabelText("Phone"), "01700000099");
  await user.click(screen.getByRole("button", { name: /Update Profile/ }));
  await screen.findByText("Profile updated successfully!");
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].body).toMatchObject({
    company_name: "Shop 1",
    phone: "01700000099",
  });
  expect(errors).not.toHaveBeenCalled();
});
