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
