import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

it("[AD-LAYOUT-002] the top bar links to the user manual PDF, which ships in public/manual", async () => {
  renderWithProviders(<AppLayout />);
  const link = await screen.findByTestId("user-guide-link");
  expect(link.getAttribute("href")).toBe("/manual/PosBuzz-Admin-Manual.pdf");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(existsSync(resolve(__dirname, "../public/manual/PosBuzz-Admin-Manual.pdf"))).toBe(true);
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
