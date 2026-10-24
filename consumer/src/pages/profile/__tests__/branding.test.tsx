import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { endpoints } from "../../../api/endpoints";
import { captureRequests } from "../../../test/msw/capture";
import { renderWithProviders } from "../../../test/render";
import Profile from "../index";

const CDN = "https://res.cloudinary.com/demo/image/upload";
const LOGO = `${CDN}/v1/posbuzz/wide-logo.png`;
const ICON = `${CDN}/v1/posbuzz/icon.png`;

it("[CO-LOGO-005] explains what each image needs and previews it where it will be used", () => {
  renderWithProviders(<Profile />, {
    user: { company_name: "Rahman Store", logo: LOGO, logo_icon: null },
  });
  expect(screen.getByText(/At least 600 px wide/)).toBeTruthy();
  expect(screen.getByText(/Square PNG, at least 256 × 256 px/)).toBeTruthy();

  const preview = within(screen.getByTestId("brand-preview"));
  // no icon yet: the square spots use the logo, sized for them
  expect(preview.getByText("Uses your logo (no app icon yet)")).toBeTruthy();
  expect(preview.getByAltText("App icon at 36 px")).toHaveAttribute(
    "src",
    `${CDN}/e_trim/c_fit,w_72,h_72/f_auto,q_auto/v1/posbuzz/wide-logo.png`,
  );
  // receipts show the same trimmed PNG the backend prints
  expect(preview.getByAltText("Logo on a PDF receipt")).toHaveAttribute(
    "src",
    `${CDN}/e_trim/c_limit,w_600,h_600/f_png/v1/posbuzz/wide-logo.png`,
  );
});

it("[CO-LOGO-006] keeps the saved logo and sends a removed app icon as null", async () => {
  const captured = captureRequests("patch", endpoints.updateConsumerProfile);
  const { user } = renderWithProviders(<Profile />, {
    user: { company_name: "Rahman Store", logo: LOGO, logo_icon: ICON },
  });
  expect(
    within(screen.getByTestId("brand-preview")).getByText("Uses your app icon"),
  ).toBeTruthy();
  const removeButtons = screen.getAllByTitle("Remove file");
  expect(removeButtons).toHaveLength(2);
  await user.click(removeButtons[1]); // the app icon
  await user.click(screen.getByRole("button", { name: /Update Profile/ }));
  await screen.findByText("Profile updated successfully!");
  expect(captured.calls[0].body).toMatchObject({
    logo: LOGO,
    logo_icon: null,
  });
});
