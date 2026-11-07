import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AppLayout from "./layout";
import { renderWithProviders } from "./test/render";

it("[AD-LAYOUT-001] the sidebar ends with Powered by PosBuzz, and PB when collapsed (same as the consumer app)", async () => {
  const { user } = renderWithProviders(<AppLayout />);
  expect(await screen.findByText("Powered by PosBuzz")).toBeTruthy();

  await user.click(screen.getByRole("img", { name: "menu-fold" }));
  expect(await screen.findByText("PB")).toBeTruthy();
  expect(screen.queryByText("Powered by PosBuzz")).toBeNull();
});

it("[AD-LAYOUT-002] the header has no manual shortcut", async () => {
  renderWithProviders(<AppLayout />);
  expect(screen.queryByTestId("user-guide-link")).toBeNull();
  expect(screen.queryByRole("link", { name: /manual/i })).toBeNull();
});

it("[AD-LAYOUT-003] Settings shows for any user allowed one of its pages, and is hidden when none is allowed", async () => {
  const withBackup = renderWithProviders(<AppLayout />, {
    permissions: ["users"],
  });
  expect(await screen.findByText("Settings")).toBeTruthy();
  withBackup.unmount();

  renderWithProviders(<AppLayout />, { permissions: ["plans"] });
  expect(await screen.findByText("Plans")).toBeTruthy();
  expect(screen.queryByText("Settings")).toBeNull();
});
