import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import Settings from "../index";

it("[CO-SMOKE-pos-layout-settings] selects and saves the restaurant layout in browser preferences", async () => {
  const errors = vi.spyOn(console, "error");
  const { user } = renderWithProviders(<Settings />);
  await user.click(screen.getByText("Restaurant POS"));
  await user.click(screen.getByRole("button", { name: /Save POS layout/ }));
  await screen.findByText(
    "POS layout saved. It will be used the next time POS opens.",
  );
  expect(localStorage.getItem("posLayout")).toBe("restaurant");
  expect(errors).not.toHaveBeenCalled();
});
