import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AppLayout from "./layout";
import { renderWithProviders } from "./test/render";

it("[CO-LAYOUT-001] the sidebar ends with Powered by PosBuzz, and PB when collapsed (same as the admin app)", async () => {
  const { user } = renderWithProviders(<AppLayout />);
  expect(await screen.findByText("Powered by PosBuzz")).toBeTruthy();

  await user.click(screen.getByRole("img", { name: "menu-fold" }));
  expect(await screen.findByText("PB")).toBeTruthy();
  expect(screen.queryByText("Powered by PosBuzz")).toBeNull();
});

it("[CO-LAYOUT-002] the top bar links to the user manual PDF, which ships in public/manual", async () => {
  renderWithProviders(<AppLayout />);
  const link = await screen.findByTestId("user-guide-link");
  expect(link.getAttribute("href")).toBe("/manual/PosBuzz-Shop-App-Manual.pdf");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(existsSync(resolve(__dirname, "../public/manual/PosBuzz-Shop-App-Manual.pdf"))).toBe(true);
});
